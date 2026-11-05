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
    // A mail always carries the whole OT date of one workshop and department (every completed office form of it), so its
    // General Affairs recipients replace the earlier file instead of adding to it; a form is never counted twice that way.
    public class GeneralAffairsReportService : BaseService<IAttendanceUnitOfWork>, IGeneralAffairsReportService, IMailDeliveryTracker
    {
        // ponytail: in-process lock; two IIS workers during an overlapped recycle could still both send (harmless, same content).
        private static readonly SemaphoreSlim SendGate = new(1, 1);
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

        // A permanently failed mail puts its date back in the queue, unless a newer mail of that date exists.
        public async Task TrackAsync(string trackingId, bool sent, bool permanent, int attempts, string? error)
        {
            if (sent || !permanent || AttendanceMailLogService.ParseTrackingId(trackingId) is not { } mailLogId) return;
            var dispatch = await _unitOfWork.GeneralAffairsDispatches.FirstOrDefaultAsync(x => x.MailLogId == mailLogId);
            if (dispatch == null) return;
            var newer = await _unitOfWork.GeneralAffairsDispatches.FirstOrDefaultAsync(
                x => x.OtDate == dispatch.OtDate && x.WorkshopId == dispatch.WorkshopId && x.DepartmentId == dispatch.DepartmentId && x.Id > dispatch.Id);
            if (newer != null) return;

            var forms = await _unitOfWork.OtForms.FindAsync(
                x => !x.IsProductionForm && x.GeneralAffairsSentDate == dispatch.OtDate && x.WorkshopId == dispatch.WorkshopId
                     && x.DepartmentId == dispatch.DepartmentId);
            foreach (var form in forms) form.GeneralAffairsResendPending = true;
            await _unitOfWork.SaveChangesAsync();
        }

        private IQueryable<OtForm> CompletedOfficeForms() =>
            _unitOfWork.OtForms.GetQueryable().Where(x => !x.IsProductionForm && !x.IsDeleted && x.Status == (int)OtFormStatus.Completed);

        private async Task<bool> SendDateAsync(DateOnly date, Workshop workshop, Department department, string emails, AttendanceSettingDto setting)
        {
            var forms = (await _unitOfWork.OtForms.FindAsync(x => !x.IsProductionForm && !x.IsDeleted && x.Status == (int)OtFormStatus.Completed
                && x.Date == date && x.WorkshopId == workshop.Id && x.DepartmentId == department.Id)).OrderBy(x => x.Id).ToList();
            var formIds = forms.Select(x => x.Id).ToList();
            // Sent under this date earlier but no longer a completed form of it (re-submitted, rejected, deleted or moved).
            var dropped = await _unitOfWork.OtForms.FindAsync(x => !x.IsProductionForm && x.GeneralAffairsSentDate == date
                && x.WorkshopId == workshop.Id && x.DepartmentId == department.Id && !formIds.Contains(x.Id));
            var earlier = await _unitOfWork.GeneralAffairsDispatches.FindAsync(
                x => x.OtDate == date && x.WorkshopId == workshop.Id && x.DepartmentId == department.Id);
            var version = earlier.Count + 1;

            if (forms.Count > 0 || version > 1)
            {
                var rows = await LoadRowsAsync(formIds);
                var previous = earlier.MaxBy(x => x.Id);
                var suffix = version > 1 ? $" (lan {version})" : "";
                var label = ToAsciiFileName($"{workshop.WorkshopCode} {department.DepartmentCode} {date:dd-MM-yyyy}{suffix}");
                var attachments = new List<MailAttachment> { new($"Du lieu tang ca {label}.xlsx", BuildExcel(rows)) };
                if (forms.Count > 0)
                {
                    var dtos = new List<OtFormDto>();
                    foreach (var id in formIds) dtos.Add(await _otFormService.GetByIdAsync(id));
                    attachments.AddRange(await RenderPdfsAsync(dtos, setting));
                }

                var subject = $"Dữ liệu tăng ca Phòng {department.DepartmentNameVn} ngày {date:dd/MM/yyyy} - Xưởng {workshop.WorkshopNameVn}"
                    + (version > 1 ? $" - Cập nhật lần {version} (thay thế bản đã gửi trước)" : "");
                var html = _templateRenderer.Render("GeneralAffairs/OtDataReport.html", new Dictionary<string, string>
                {
                    ["DepartmentName"] = WebUtility.HtmlEncode(department.DepartmentNameVn),
                    ["WorkshopName"] = WebUtility.HtmlEncode(workshop.WorkshopNameVn),
                    ["OtDateText"] = date.ToString("dd/MM/yyyy"),
                    ["FormCount"] = forms.Count.ToString(),
                    ["EmployeeCount"] = rows.Count.ToString(),
                    ["VersionNote"] = version > 1
                        ? $"<strong style=\"color:#8a2432;\">Đây là bản cập nhật lần {version}: vui lòng xoá dữ liệu ngày {date:dd/MM/yyyy} đã nhận trước đó và dùng bản này thay thế.</strong>"
                        : "",
                    ["ChangeTable"] = previous?.Snapshot is { } snapshot
                        ? BuildChangeTable(JsonSerializer.Deserialize<List<ReportRow>>(snapshot)!, rows)
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
                    Snapshot = JsonSerializer.Serialize(rows),
                    CreatedAt = TimeHelper.GetCurrentUtcTime()
                });
            }

            foreach (var form in forms)
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
            return forms.Count > 0 || version > 1;
        }

        private record ReportRow(string Code, string? GroupName, string LastName, string FirstName, DateOnly Date,
            decimal Hours, string DepartmentCode, bool HasMeal, bool EatLater);

        // One row per employee per form (not merged per day), so the meal columns stay true to each form.
        private async Task<List<ReportRow>> LoadRowsAsync(IReadOnlyCollection<int> formIds)
        {
            var settings = await _settingService.GetAsync();
            var rows = await _unitOfWork.OtFormEmployees.ToListAsync(
                _unitOfWork.OtFormEmployees.GetQueryable()
                    .Where(x => !x.IsRemoved && formIds.Contains(x.OtFormId))
                    .OrderBy(x => x.OtForm.Date).ThenBy(x => x.OtFormId).ThenBy(x => x.Employee.Code),
                x => new
                {
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
                return new ReportRow(row.Code, row.GroupName, row.LastName, row.FirstName, row.Date,
                    MealTicketCalculator.CalculateOtHours(row.StartTime, row.EndTime, row.DidEat, settings),
                    row.DepartmentCode, hasMeal, hasMeal && !row.DidEat);
            }).ToList();
        }

        // Per employee code: added, removed, or changed hours/meal versus the previous mail of the date.
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

            const string cell = "padding:6px 8px; border:1px solid #e7e9ee; font-size:13px; color:#16233d;";
            if (changes.Count == 0)
                return "<p style=\"margin:16px 0 0 0; font-size:14px; line-height:23px; color:#4a5266;\">Không có thay đổi về nhân viên, giờ tăng ca hay suất ăn so với bản trước.</p>";

            var html = new StringBuilder("<p style=\"margin:16px 0 6px 0; font-size:14px; font-weight:bold; color:#16233d;\">Thay đổi so với bản trước</p>")
                .Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;\"><tr>");
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

        private static byte[] BuildExcel(List<ReportRow> rows)
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Du lieu tang ca");
            string[] headers = ["MNV", "BOPHAN", "HO", "TEN", "Ngay_TC", "Gio_tang_ca", "BP", "Co_an", "An_sau"];
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            var rowIndex = 2;
            foreach (var row in rows)
            {
                sheet.Cell(rowIndex, 1).Value = row.Code;
                sheet.Cell(rowIndex, 2).Value = row.GroupName;
                sheet.Cell(rowIndex, 3).Value = row.LastName;
                sheet.Cell(rowIndex, 4).Value = row.FirstName;
                sheet.Cell(rowIndex, 5).Value = row.Date.ToDateTime(TimeOnly.MinValue);
                sheet.Cell(rowIndex, 5).Style.DateFormat.Format = "dd-MMM-yy";
                sheet.Cell(rowIndex, 6).Value = row.Hours;
                sheet.Cell(rowIndex, 7).Value = row.DepartmentCode;
                sheet.Cell(rowIndex, 8).Value = row.HasMeal ? "x" : "";
                sheet.Cell(rowIndex, 9).Value = row.EatLater ? "x" : "";
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
        private static async Task<List<MailAttachment>> RenderPdfsAsync(IReadOnlyList<OtFormDto> forms, AttendanceSettingDto setting)
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

            return BuildPdfFileNames(forms).Select((name, i) => new MailAttachment(name, Convert.FromBase64String(pdfs[i]))).ToList();
        }

        // Same rule as otFormPdfFileName in the web app; repeats within one mail get _2, _3.
        private static List<string> BuildPdfFileNames(IEnumerable<OtFormDto> forms)
        {
            var used = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            return forms.Select(form =>
            {
                var name = ToAsciiFileName($"Phieu Tang Ca {form.DepartmentCode}_{form.GroupNameVn}_{form.Date:dd-MM-yyyy}");
                var count = used[name] = used.GetValueOrDefault(name) + 1;
                return count == 1 ? $"{name}.pdf" : $"{name}_{count}.pdf";
            }).ToList();
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
