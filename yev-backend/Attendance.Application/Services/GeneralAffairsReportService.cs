using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using Microsoft.Extensions.Logging;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // A mail covers one OT date of one workshop and department but only what General Affairs does not have yet: forms
    // signed since the last mail, edited forms that replace their earlier copy, and cancellations.
    public class GeneralAffairsReportService : BaseService<IAttendanceUnitOfWork>, IGeneralAffairsReportService, IMailDeliveryTracker
    {
        // ponytail: in-process lock; two IIS workers during an overlapped recycle could still both send a duplicate mail (same files, same names).
        private static readonly SemaphoreSlim SendGate = new(1, 1);

        private const string NoteAdded = "Bổ sung";
        private const string NoteReplaced = "Thay thế";
        private const string NoteCancelled = "Huỷ";
        private const string MailFont = "font-family:'Times New Roman', 'Liberation Serif', Georgia, serif;";
        private static readonly TimeSpan PdfTimeout = TimeSpan.FromMinutes(5);

        private readonly IOtFormService _otFormService;
        private readonly IAttendanceSettingService _settingService;
        private readonly IAttendanceMailLogService _mailLogService;
        private readonly IEmailTemplateRenderer _templateRenderer;
        private readonly ILogger<GeneralAffairsReportService> _logger;

        public GeneralAffairsReportService(
            IAttendanceUnitOfWork unitOfWork,
            IOtFormService otFormService,
            IAttendanceSettingService settingService,
            IAttendanceMailLogService mailLogService,
            IEmailTemplateRenderer templateRenderer,
            ILogger<GeneralAffairsReportService> logger) : base(unitOfWork)
        {
            _otFormService = otFormService;
            _settingService = settingService;
            _mailLogService = mailLogService;
            _templateRenderer = templateRenderer;
            _logger = logger;
        }

        public async Task<(byte[] Content, string FileName)> ExportExcelAsync(DateOnly fromDate, DateOnly toDate, int? workshopId = null, int? departmentId = null)
        {
            if (toDate < fromDate)
                throw new DomainException("Đến ngày phải sau Từ ngày.");
            if (toDate.DayNumber - fromDate.DayNumber > 92)
                throw new DomainException("Chỉ xuất tối đa 3 tháng một lần.");

            var formIds = await _unitOfWork.OtForms.ToListAsync(
                CompletedOfficeForms().Where(x => x.Date >= fromDate && x.Date <= toDate
                    && (workshopId == null || x.WorkshopId == workshopId)
                    && (departmentId == null || x.DepartmentId == departmentId)), x => x.Id);
            var isWholeMonth = fromDate.Day == 1 && toDate == fromDate.AddMonths(1).AddDays(-1);
            var label = fromDate == toDate ? fromDate.ToString("dd-MM-yyyy")
                : isWholeMonth ? fromDate.ToString("MM-yyyy")
                : $"{fromDate:dd-MM-yyyy} - {toDate:dd-MM-yyyy}";
            return (BuildExcel(await LoadRowsAsync(formIds)), $"Du lieu tang ca {label}.xlsx");
        }

        public async Task<int> SendPendingAsync()
        {
            await SendGate.WaitAsync();
            try
            {
                var setting = await _settingService.GetAsync();
                // A workshop/department pair without recipients keeps its forms unsent, so setting its emails later sends the backlog.
                var recipients = (await _unitOfWork.GeneralAffairsRecipients.GetAllAsync()).ToDictionary(x => (x.WorkshopId, x.DepartmentId), x => x.Emails);
                if (recipients.Count == 0)
                    throw new DomainException("Chưa cấu hình email Tổng vụ cho phòng ban nào.");
                var workshops = (await _unitOfWork.Workshops.GetAllAsync()).ToDictionary(x => x.Id);
                var departments = (await _unitOfWork.Departments.GetAllAsync()).ToDictionary(x => x.Id);

                var office = _unitOfWork.OtForms.GetQueryable().Where(x => !x.IsProductionForm);
                var newPairs = await _unitOfWork.OtForms.ToListAsync(
                    office.Where(x => !x.IsDeleted && x.Status == (int)OtFormStatus.Completed && x.GeneralAffairsSentDate == null),
                    x => new { x.Date, x.WorkshopId, x.DepartmentId });
                // A re-submitted form waits until it is completed, rejected or deleted, so its day is sent once, not twice.
                // A form's workshop and department are fixed at creation, so they are also the ones it was sent to.
                var resent = await _unitOfWork.OtForms.ToListAsync(
                    office.Where(x => x.GeneralAffairsResendPending && (x.IsDeleted || x.Status != (int)OtFormStatus.InApproval)),
                    x => new { x.GeneralAffairsSentDate, x.Date, x.WorkshopId, x.DepartmentId, IsCompleted = !x.IsDeleted && x.Status == (int)OtFormStatus.Completed });
                // Only days before today, so a day goes out once it is over; later dates keep their flags for a later run.
                var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
                var pairs = newPairs
                    .Concat(resent.Where(x => x.GeneralAffairsSentDate != null).Select(x => new { Date = x.GeneralAffairsSentDate!.Value, x.WorkshopId, x.DepartmentId }))
                    .Concat(resent.Where(x => x.IsCompleted).Select(x => new { x.Date, x.WorkshopId, x.DepartmentId }))
                    .Where(x => x.Date < today && recipients.ContainsKey((x.WorkshopId, x.DepartmentId)))
                    .Distinct().OrderBy(x => x.Date).ThenBy(x => x.WorkshopId).ThenBy(x => x.DepartmentId).ToList();

                var sent = 0;
                foreach (var pair in pairs)
                    if (await SendDateAsync(pair.Date, workshops[pair.WorkshopId], departments[pair.DepartmentId],
                            recipients[(pair.WorkshopId, pair.DepartmentId)], setting)) sent++;

                var settingRow = (await _unitOfWork.AttendanceSettings.GetAllAsync()).First();
                settingRow.LastGeneralAffairsSendDate = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
                await _unitOfWork.SaveChangesAsync();
                return sent;
            }
            finally
            {
                SendGate.Release();
            }
        }

        // A permanently failed mail puts exactly its own forms back in the queue, each under the note it went out with.
        public async Task TrackAsync(string trackingId, bool sent, bool permanent, int attempts, string? error)
        {
            if (sent || !permanent || AttendanceMailLogService.ParseTrackingId(trackingId) is not { } mailLogId) return;
            var dispatch = await _unitOfWork.GeneralAffairsDispatches.FirstOrDefaultAsync(x => x.MailLogId == mailLogId);
            if (dispatch?.Snapshot == null) return;

            var notes = JsonSerializer.Deserialize<List<ReportRow>>(dispatch.Snapshot)!
                .Where(x => x.Note != null).DistinctBy(x => x.OtFormId).ToDictionary(x => x.OtFormId, x => x.Note);
            var formIds = notes.Keys.ToList();
            foreach (var form in await _unitOfWork.OtForms.FindAsync(x => formIds.Contains(x.Id)))
            {
                form.GeneralAffairsSentDate = notes[form.Id] switch
                {
                    NoteAdded => null,
                    NoteCancelled => dispatch.OtDate,
                    _ => form.GeneralAffairsSentDate
                };
                form.GeneralAffairsResendPending = notes[form.Id] != NoteAdded;
            }
            // Never delivered, so it must not count as "the earlier copy" in later comparisons.
            dispatch.Snapshot = null;
            await _unitOfWork.SaveChangesAsync();
        }

        private IQueryable<OtForm> CompletedOfficeForms() =>
            _unitOfWork.OtForms.GetQueryable().Where(x => !x.IsProductionForm && !x.IsDeleted && x.Status == (int)OtFormStatus.Completed);

        private async Task<bool> SendDateAsync(DateOnly date, Workshop workshop, Department department, string emails, AttendanceSettingDto setting)
        {
            var forms = (await _unitOfWork.OtForms.FindAsync(x => !x.IsProductionForm && !x.IsDeleted && x.Status == (int)OtFormStatus.Completed
                && x.Date == date && x.WorkshopId == workshop.Id && x.DepartmentId == department.Id)).OrderBy(x => x.Id).ToList();
            var formIds = forms.Select(x => x.Id).ToList();
            var added = forms.Where(x => x.GeneralAffairsSentDate == null).ToList();
            // A form moved here from another date is announced by this mail alone, as the replacement of its old copy.
            var replaced = forms.Where(x => x.GeneralAffairsSentDate != null && (x.GeneralAffairsResendPending || x.GeneralAffairsSentDate != date)).ToList();
            // Forms being re-signed stay out: they are reported once, when their outcome is known.
            var dropped = (await _unitOfWork.OtForms.FindAsync(x => !x.IsProductionForm && x.GeneralAffairsSentDate == date
                && x.WorkshopId == workshop.Id && x.DepartmentId == department.Id && !formIds.Contains(x.Id)
                && (x.IsDeleted || x.Status == (int)OtFormStatus.Rejected))).OrderBy(x => x.Id).ToList();
            if (added.Count + replaced.Count + dropped.Count == 0) return false;
            var resigningCount = (await _unitOfWork.OtForms.FindAsync(x => !x.IsProductionForm && !x.IsDeleted && x.Status == (int)OtFormStatus.InApproval
                && x.GeneralAffairsSentDate == date && x.WorkshopId == workshop.Id && x.DepartmentId == department.Id)).Count;

            var sentDates = replaced.Select(x => x.GeneralAffairsSentDate!.Value).Append(date).Distinct().ToList();
            var dispatches = await _unitOfWork.GeneralAffairsDispatches.FindAsync(
                x => sentDates.Contains(x.OtDate) && x.WorkshopId == workshop.Id && x.DepartmentId == department.Id);
            var history = dispatches.Where(x => x.Snapshot != null).OrderByDescending(x => x.Id)
                .Select(x => new SentCopy(x.OtDate, x.CreatedAt, JsonSerializer.Deserialize<List<ReportRow>>(x.Snapshot!)!)).ToList();
            // Undelivered mails have no snapshot, so the number follows what General Affairs actually received.
            var version = history.Count(x => x.OtDate == date) + 1;

            var notes = added.ToDictionary(x => x.Id, _ => NoteAdded);
            foreach (var form in replaced) notes[form.Id] = NoteReplaced;
            var rows = (await LoadRowsAsync(formIds)).Select(x => x with { Note = notes.GetValueOrDefault(x.OtFormId) }).ToList();
            var attachedRows = rows.Where(x => x.Note != null).ToList();
            var sentFormIds = history.Where(x => x.OtDate == date).SelectMany(x => x.Rows).Select(x => x.OtFormId).Where(x => x > 0).Distinct().ToList();
            var fileNames = await BuildPdfFileNamesAsync(date, workshop.Id, department, sentFormIds);
            var isFollowUp = version > 1 || replaced.Count > 0 || dropped.Count > 0;

            var attachments = new List<MailAttachment>();
            if (notes.Count > 0)
            {
                var suffix = version > 1 ? $" (lan {version})" : "";
                var label = ToAsciiFileName($"{workshop.WorkshopCode} {department.DepartmentCode} {date:dd-MM-yyyy}{suffix}");
                attachments.Add(new($"Du lieu tang ca {label}.xlsx", BuildExcel(attachedRows, showNote: isFollowUp)));
                var dtos = new List<OtFormDto>();
                foreach (var id in notes.Keys.Order()) dtos.Add(await _otFormService.GetByIdAsync(id));
                attachments.AddRange(await RenderPdfsAsync(dtos, fileNames, setting));
            }

            var replacedIds = replaced.Select(x => x.Id).ToList();
            var reasons = (await _unitOfWork.OtFormEditLogs.FindAsync(x => replacedIds.Contains(x.OtFormId) && x.ActionType == (int)OtFormEditActionType.Resubmitted))
                .OrderBy(x => x.Id).GroupBy(x => x.OtFormId).ToDictionary(x => x.Key, x => x.Last().NewValue);

            var subject = $"Dữ liệu tăng ca Phòng {department.DepartmentNameVn} ngày {date:dd/MM/yyyy} - Xưởng {workshop.WorkshopNameVn}"
                + (version > 1 ? $" - Bổ sung lần {version}" : "");
            var html = _templateRenderer.Render("GeneralAffairs/OtDataReport.html", new Dictionary<string, string>
            {
                ["SendVerb"] = version > 1 ? "gửi bổ sung" : "gửi",
                ["DepartmentName"] = WebUtility.HtmlEncode(department.DepartmentNameVn),
                ["WorkshopName"] = WebUtility.HtmlEncode(workshop.WorkshopNameVn),
                ["OtDateText"] = date.ToString("dd/MM/yyyy"),
                ["FormCount"] = notes.Count.ToString(),
                ["EmployeeCount"] = attachedRows.Count.ToString(),
                ["AttachmentNote"] = notes.Count > 0
                    ? "Đính kèm: file Excel dữ liệu tăng ca và phiếu tăng ca (PDF) của từng đơn."
                    : "Mail này không có tệp đính kèm.",
                ["ChangeSections"] = isFollowUp
                    ? BuildChangeSections(date, version > 1 ? added : [], replaced, dropped, fileNames, history, rows, reasons, resigningCount)
                    : "",
            });

            var mailLogId = await _mailLogService.SendAsync(null, emails, subject, html, attachments);
            if (mailLogId == null)
            {
                _logger.LogError("Không đưa được mail Tổng vụ ngày {Date} xưởng {Workshop} phòng {Department} vào hàng đợi; lượt sau sẽ gửi lại.",
                    date, workshop.WorkshopCode, department.DepartmentCode);
                return false;
            }
            await _unitOfWork.GeneralAffairsDispatches.AddAsync(new GeneralAffairsDispatch
            {
                OtDate = date,
                WorkshopId = workshop.Id,
                DepartmentId = department.Id,
                Version = version,
                FormCount = forms.Count,
                MailLogId = mailLogId,
                // The whole day, so a later edit finds its earlier copy; cancelled forms are marked for TrackAsync only.
                Snapshot = JsonSerializer.Serialize(rows.Concat(dropped.Select(x => new ReportRow(x.Id, "", null, "", "", date, 0, "", false, false, NoteCancelled)))),
                CreatedAt = TimeHelper.GetCurrentUtcTime()
            });

            foreach (var form in added.Concat(replaced))
            {
                form.GeneralAffairsSentDate = date;
                form.GeneralAffairsResendPending = false;
            }
            foreach (var form in dropped)
            {
                form.GeneralAffairsSentDate = null;
                form.GeneralAffairsResendPending = false;
            }
            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        // OtFormId is 0 and Note null in snapshots written before mails became incremental.
        private record ReportRow(int OtFormId, string Code, string? GroupName, string LastName, string FirstName, DateOnly Date,
            decimal Hours, string DepartmentCode, bool HasMeal, bool EatLater, string? Note = null);

        private record SentCopy(DateOnly OtDate, DateTime SentAt, List<ReportRow> Rows);

        // One row per employee per form: edits and before/after tables work per form; BuildExcel merges per day.
        private async Task<List<ReportRow>> LoadRowsAsync(IReadOnlyCollection<int> formIds)
        {
            var settings = await _settingService.GetAsync();
            var rows = await _unitOfWork.OtFormEmployees.ToListAsync(
                _unitOfWork.OtFormEmployees.GetQueryable()
                    .Where(x => !x.IsRemoved && formIds.Contains(x.OtFormId))
                    .OrderBy(x => x.OtForm.Date).ThenBy(x => x.OtFormId).ThenBy(x => x.Employee.Code),
                x => new
                {
                    x.OtFormId,
                    x.Employee.Code,
                    x.Employee.LastName,
                    x.Employee.FirstName,
                    GroupName = x.OtForm.Group!.GroupNameVn,
                    x.OtForm.Department.DepartmentCode,
                    x.OtForm.Date,
                    x.StartTime,
                    x.EndTime,
                    x.DidEat
                });
            return rows.Select(row =>
            {
                var hasMeal = MealTicketCalculator.CalculateMealTicketType(row.StartTime, row.EndTime, row.DidEat, settings) != MealTicketType.None;
                // "Eat later" only applies to someone who gets a meal ticket.
                return new ReportRow(row.OtFormId, row.Code, row.GroupName, row.LastName, row.FirstName, row.Date,
                    MealTicketCalculator.CalculateOtHours(row.StartTime, row.EndTime, row.DidEat, settings),
                    row.DepartmentCode, hasMeal, hasMeal && !row.DidEat);
            }).ToList();
        }

        private static string BuildChangeSections(DateOnly date, List<OtForm> added, List<OtForm> replaced, List<OtForm> dropped,
            Dictionary<int, string> fileNames, List<SentCopy> history, List<ReportRow> rows, Dictionary<int, string?> reasons, int resigningCount)
        {
            const string titleStyle = $"{MailFont} margin:16px 0 4px 0; font-size:14px; font-weight:bold; color:#16233d;";
            const string lineStyle = $"{MailFont} margin:0 0 4px 0; font-size:14px; line-height:22px; color:#4a5266;";
            string Describe(OtForm form) =>
                $"<strong style=\"{MailFont} color:#16233d;\">{WebUtility.HtmlEncode(fileNames[form.Id])}</strong>: "
                + $"{form.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture)}–{form.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture)}, {form.NumberOfEmployee} người";

            var html = new StringBuilder();
            if (added.Count > 0)
            {
                html.Append($"<p style=\"{titleStyle}\">Bổ sung {added.Count} đơn:</p>");
                foreach (var form in added) html.Append($"<p style=\"{lineStyle}\">{Describe(form)}</p>");
            }
            if (replaced.Count > 0)
            {
                html.Append($"<p style=\"{titleStyle}\">Chỉnh sửa {replaced.Count} đơn:</p>");
                foreach (var form in replaced)
                {
                    var after = rows.Where(x => x.OtFormId == form.Id).ToList();
                    var (before, sentAt) = FindEarlierCopy(form, after, history);
                    var moved = form.GeneralAffairsSentDate != date ? $" Chuyển từ ngày {form.GeneralAffairsSentDate:dd/MM/yyyy}." : "";
                    var sent = sentAt is { } at ? $"Thay thế đơn đã gửi ngày {at:dd/MM/yyyy}." : "Thay thế đơn đã gửi.";
                    var reason = reasons.GetValueOrDefault(form.Id) is { Length: > 0 } text ? $" Lý do: {WebUtility.HtmlEncode(text)}" : "";
                    html.Append($"<p style=\"{lineStyle}\">{Describe(form)}. {sent}{moved}{reason}</p>");
                    if (before.Count > 0) html.Append(BuildChangeTable(before, after));
                }
            }
            if (dropped.Count > 0)
            {
                html.Append($"<p style=\"{titleStyle}\">Huỷ {dropped.Count} đơn đã gửi:</p>");
                foreach (var form in dropped)
                    html.Append($"<p style=\"{lineStyle}\">{Describe(form)}. {(form.IsDeleted ? "Đơn đã bị xoá." : "Đơn đã bị từ chối.")}</p>");
            }
            var dayForms = rows.Select(x => x.OtFormId).Distinct().Count();
            var resigning = resigningCount > 0 ? $" Chưa tính {resigningCount} đơn đã gửi đang được trình ký lại." : "";
            html.Append($"<p style=\"{lineStyle} margin-top:16px;\">Tổng ngày {date:dd/MM/yyyy} sau lần gửi này: {dayForms} đơn, {rows.Count} lượt nhân viên.{resigning}</p>");
            return html.ToString();
        }

        // Older snapshots have no form ids, so those compare only the employee codes still on the form.
        private static (List<ReportRow> Rows, DateTime? SentAt) FindEarlierCopy(OtForm form, List<ReportRow> after, List<SentCopy> history)
        {
            var codes = after.Select(x => x.Code).ToHashSet();
            foreach (var copy in history.Where(x => x.OtDate == form.GeneralAffairsSentDate))
            {
                var own = copy.Rows.Where(x => x.OtFormId == form.Id && x.Note != NoteCancelled).ToList();
                if (own.Count > 0) return (own, copy.SentAt);
                if (copy.Rows.Any(x => x.OtFormId == 0)) return (copy.Rows.Where(x => codes.Contains(x.Code)).ToList(), copy.SentAt);
            }
            return ([], null);
        }

        // Per employee code: added, removed, or changed hours/meal versus the copy General Affairs already has.
        private static string BuildChangeTable(List<ReportRow> before, List<ReportRow> after)
        {
            static string Describe(IEnumerable<ReportRow> rows) => string.Join(" + ", rows
                .Select(r => $"{r.Hours.ToString("0.##", CultureInfo.InvariantCulture)}h" + (r.HasMeal ? ", có ăn" : "") + (r.EatLater ? ", ăn sau" : ""))
                .Order());

            var beforeByCode = before.ToLookup(x => x.Code);
            var afterByCode = after.ToLookup(x => x.Code);
            var changes = new List<(string Code, string Name, string Kind, string Was, string Now)>();
            foreach (var code in before.Select(x => x.Code).Union(after.Select(x => x.Code)).Order())
            {
                var was = beforeByCode[code].Any() ? Describe(beforeByCode[code]) : "—";
                var now = afterByCode[code].Any() ? Describe(afterByCode[code]) : "—";
                if (was == now) continue;
                var row = afterByCode[code].FirstOrDefault() ?? beforeByCode[code].First();
                changes.Add((code, $"{row.LastName} {row.FirstName}", was == "—" ? "Thêm" : now == "—" ? "Bỏ" : "Thay đổi", was, now));
            }

            const string cell = $"{MailFont} padding:6px 8px; border:1px solid #e7e9ee; font-size:13px; color:#16233d;";
            if (changes.Count == 0)
                return $"<p style=\"{MailFont} margin:0 0 8px 0; font-size:14px; line-height:22px; color:#4a5266;\">Không có thay đổi về nhân viên, giờ tăng ca hay suất ăn so với bản trước.</p>";

            var html = new StringBuilder("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse; margin:4px 0 12px 0;\"><tr>");
            foreach (var header in new[] { "MNV", "Họ tên", "", "Trước", "Sau" })
                html.Append($"<td style=\"{cell} background-color:#f7f8fa; font-weight:bold;\">{header}</td>");
            html.Append("</tr>");
            foreach (var change in changes)
            {
                var color = change.Kind == "Bỏ" ? "#8a2432" : change.Kind == "Thêm" ? "#1b6b3a" : "#16233d";
                html.Append("<tr>")
                    .Append($"<td style=\"{cell}\">{WebUtility.HtmlEncode(change.Code)}</td>")
                    .Append($"<td style=\"{cell}\">{WebUtility.HtmlEncode(change.Name)}</td>")
                    .Append($"<td style=\"{cell} color:{color}; font-weight:bold; white-space:nowrap;\">{change.Kind}</td>")
                    .Append($"<td style=\"{cell}\">{change.Was}</td>")
                    .Append($"<td style=\"{cell}\">{change.Now}</td>")
                    .Append("</tr>");
            }
            return html.Append("</table>").ToString();
        }

        private static byte[] BuildExcel(List<ReportRow> rows, bool showNote = false)
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Du lieu tang ca");
            string[] headers = ["MNV", "BOPHAN", "HO", "TEN", "Ngay_TC", "Gio_tang_ca", "BP", "Co_an", "An_sau", .. showNote ? new[] { "Ghi_chu" } : []];
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            // One line per employee per day. Lines with different notes stay apart: a "Thay thế" amount must replace exactly what it replaced.
            var lines = rows.GroupBy(x => (x.Code, x.Date, x.Note)).Select(x => x.First() with
            {
                GroupName = string.Join("; ", x.Select(y => y.GroupName).Distinct()),
                DepartmentCode = string.Join("; ", x.Select(y => y.DepartmentCode).Distinct()),
                Hours = x.Sum(y => y.Hours),
                HasMeal = x.Any(y => y.HasMeal),
                EatLater = x.Any(y => y.EatLater),
            }).ToList();

            var rowIndex = 2;
            foreach (var row in lines)
            {
                sheet.Cell(rowIndex, 1).Value = ExcelCodeCell.From(row.Code);
                sheet.Cell(rowIndex, 2).Value = row.GroupName;
                sheet.Cell(rowIndex, 3).Value = row.LastName;
                sheet.Cell(rowIndex, 4).Value = row.FirstName;
                sheet.Cell(rowIndex, 5).Value = row.Date.ToDateTime(TimeOnly.MinValue);
                sheet.Cell(rowIndex, 5).Style.DateFormat.Format = "dd-MMM-yy";
                sheet.Cell(rowIndex, 6).Value = row.Hours;
                sheet.Cell(rowIndex, 7).Value = row.DepartmentCode;
                sheet.Cell(rowIndex, 8).Value = row.HasMeal ? "x" : "";
                sheet.Cell(rowIndex, 9).Value = row.EatLater ? "x" : "";
                if (showNote) sheet.Cell(rowIndex, 10).Value = row.Note;
                rowIndex++;
            }
            sheet.Range(1, 8, rowIndex - 1, 9).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        // PDFs come from the same HTML template the web app prints, run by pdf-renderer/render.cjs under Node
        // (bundled by yev-frontend `pnpm build:pdf-renderer`; node.exe ships next to it on the server).
        // Everything stays in memory: writing PDFs to disk and deleting them gets the process killed by Trend Micro
        // as "Unauthorized file encryption". One attachment per form: PDFs barely shrink in a ZIP and ZIPs get quarantined.
        private static async Task<List<MailAttachment>> RenderPdfsAsync(IReadOnlyList<OtFormDto> forms, Dictionary<int, string> fileNames, AttendanceSettingDto setting)
        {
            var rendererDir = Path.Combine(AppContext.BaseDirectory, "pdf-renderer");
            var script = Path.Combine(rendererDir, "render.cjs");
            if (!File.Exists(script))
                throw new InvalidOperationException($"Thiếu bộ tạo PDF: {script}");
            var bundledNode = Path.Combine(rendererDir, "node.exe");

            var startInfo = new ProcessStartInfo(File.Exists(bundledNode) ? bundledNode : "node")
            {
                RedirectStandardInput = true,
                // Otherwise the console code page mangles Vietnamese names.
                StandardInputEncoding = new UTF8Encoding(false),
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            startInfo.ArgumentList.Add(script);

            using var process = Process.Start(startInfo)!;
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            await process.StandardInput.WriteAsync(JsonSerializer.Serialize(new
            {
                limits = new { setting.MonthlyOtHourLimit, setting.YearlyOtHourLimit },
                forms
            }, JsonSerializerOptions.Web));
            process.StandardInput.Close();

            using var timeout = new CancellationTokenSource(PdfTimeout);
            try
            {
                await process.WaitForExitAsync(timeout.Token);
            }
            catch (OperationCanceledException)
            {
                process.Kill(entireProcessTree: true);
                throw new InvalidOperationException("Tạo PDF phiếu tăng ca quá thời gian cho phép.");
            }
            var pdfs = (await stdoutTask).Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var stderr = await stderrTask;
            if (process.ExitCode != 0 || pdfs.Length != forms.Count)
                throw new InvalidOperationException($"Tạo PDF phiếu tăng ca thất bại: {stderr}");

            return forms.Select((form, i) => new MailAttachment(fileNames[form.Id], Convert.FromBase64String(pdfs[i]))).ToList();
        }

        // Base name as otFormPdfFileName in the web app. _2, _3 count every form of the group and day, rejected or moved ones
        // too, so a form keeps its name across mails: an edited form overwrites its old file and a new one never does.
        private async Task<Dictionary<int, string>> BuildPdfFileNamesAsync(DateOnly date, int workshopId, Department department, List<int> sentFormIds)
        {
            var forms = await _unitOfWork.OtForms.ToListAsync(
                _unitOfWork.OtForms.GetQueryable()
                    .Where(x => !x.IsProductionForm && x.WorkshopId == workshopId && x.DepartmentId == department.Id
                        && (x.Date == date || x.GeneralAffairsSentDate == date || sentFormIds.Contains(x.Id)))
                    .OrderBy(x => x.Id),
                x => new { x.Id, x.Group!.GroupNameVn });
            var used = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            return forms.ToDictionary(x => x.Id, x =>
            {
                var name = ToAsciiFileName($"Phieu Tang Ca {department.DepartmentCode}_{x.GroupNameVn}_{date:dd-MM-yyyy}");
                var count = used[name] = used.GetValueOrDefault(name) + 1;
                return count == 1 ? $"{name}.pdf" : $"{name}_{count}.pdf";
            });
        }

        // Attachment names with Vietnamese marks show garbled in some mail clients and Windows tools.
        private static string ToAsciiFileName(string value)
        {
            var builder = new StringBuilder();
            foreach (var c in value.Replace('đ', 'd').Replace('Đ', 'D').Normalize(NormalizationForm.FormD))
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark || Path.GetInvalidFileNameChars().Contains(c)) continue;
                builder.Append(c);
            }
            return string.Join(' ', builder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }
    }
}
