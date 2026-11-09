using System.Globalization;
using System.Linq.Expressions;
using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Dtos.Reports;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    // Daily reports for production forms; only Completed forms count (fully approved, not just by the Manager).
    public class ProductionOtReportService : BaseService<IAttendanceUnitOfWork>, IProductionOtReportService
    {
        private const string UnknownLabel = "Chưa xác định";
        private const string OtherShiftLabel = "Khac";

        // A form belongs to a shift when its Start/End fall within the window, not only on exact match (early leave/late start).
        private static readonly (string Code, TimeOnly Start, TimeOnly End)[] ShiftWindows =
        {
            ("H", new TimeOnly(6, 0), new TimeOnly(8, 0)),
            ("B", new TimeOnly(10, 0), new TimeOnly(14, 0)),
            ("A", new TimeOnly(14, 0), new TimeOnly(18, 0)),
            ("C", new TimeOnly(18, 0), new TimeOnly(22, 0)),
        };

        private readonly IAttendanceSettingService _attendanceSettingService;

        public ProductionOtReportService(IAttendanceUnitOfWork unitOfWork, IAttendanceSettingService attendanceSettingService)
            : base(unitOfWork)
        {
            _attendanceSettingService = attendanceSettingService;
        }

        public async Task<ProductionTicketReportDto> GetTicketReportAsync(DateOnly date, int? departmentId, int? workshopId = null)
        {
            var forms = await _unitOfWork.OtForms.SelectAsync(
                x => x.IsProductionForm && !x.IsDeleted && x.Status == (int)OtFormStatus.Completed && x.Date == date
                     && (departmentId == null || x.DepartmentId == departmentId)
                     && (workshopId == null || x.WorkshopId == workshopId),
                x => new
                {
                    x.StartTime,
                    x.EndTime,
                    x.TotalHour,
                    MainTicketCount = x.ProcessPart != null ? x.ProcessPart.MainTicketCount : 0,
                    SecondaryTicketCount = x.ProcessPart != null ? x.ProcessPart.SecondaryTicketCount : 0,
                    MilkCount = x.ProcessPart != null ? x.ProcessPart.MilkCount : 0,
                    CongDoan = x.OtFormEmployees.Where(e => !e.IsRemoved).Select(e => e.CongDoanSnapshot).FirstOrDefault(),
                    Team = x.OtFormEmployees.Where(e => !e.IsRemoved).Select(e => e.TeamCodeSnapshot).FirstOrDefault(),
                    Block = x.OtFormEmployees.Where(e => !e.IsRemoved).Select(e => e.BlockCodeSnapshot).FirstOrDefault(),
                    ShiftTeam = x.OtFormEmployees.Where(e => !e.IsRemoved).Select(e => e.ShiftTeamCodeSnapshot).FirstOrDefault(),
                });

            // Group by exact time range too: one line/shift can have several rows when people start or leave at different times.
            var rows = forms
                .GroupBy(x => new { x.CongDoan, x.Team, x.Block, x.ShiftTeam, x.StartTime, x.EndTime })
                .Select(g => new ProductionTicketReportRowDto
                {
                    CongDoan = string.IsNullOrWhiteSpace(g.Key.CongDoan) ? UnknownLabel : g.Key.CongDoan!,
                    Team = string.IsNullOrWhiteSpace(g.Key.Team) ? UnknownLabel : g.Key.Team!,
                    LineCa = $"{(string.IsNullOrWhiteSpace(g.Key.Block) ? UnknownLabel : g.Key.Block)}-{(string.IsNullOrWhiteSpace(g.Key.ShiftTeam) ? UnknownLabel : g.Key.ShiftTeam)}",
                    Ca = ResolveCa(g.Key.StartTime, g.Key.EndTime),
                    StartTime = g.Key.StartTime,
                    EndTime = g.Key.EndTime,
                    TotalHour = g.First().TotalHour,
                    SecondaryTicketCount = g.Sum(x => x.SecondaryTicketCount),
                    MainTicketCount = g.Sum(x => x.MainTicketCount),
                    MilkCount = g.Sum(x => x.MilkCount),
                })
                .OrderBy(x => x.CongDoan, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.Ca, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.Team, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.LineCa, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new ProductionTicketReportDto
            {
                Date = date,
                Rows = rows,
                TotalSecondaryTicketCount = rows.Sum(x => x.SecondaryTicketCount),
                TotalMainTicketCount = rows.Sum(x => x.MainTicketCount),
                TotalMilkCount = rows.Sum(x => x.MilkCount),
            };
        }

        public async Task<(byte[] Content, string FileName)> ExportHoursReportAsync(DateOnly date, int? departmentId, int? workshopId = null)
        {
            var settings = await _attendanceSettingService.GetAsync();

            var entries = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.OtForm.IsProductionForm && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date == date && !x.IsRemoved
                     && (departmentId == null || x.OtForm.DepartmentId == departmentId)
                     && (workshopId == null || x.OtForm.WorkshopId == workshopId),
                x => new
                {
                    x.OtFormId,
                    x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    x.Employee.LastName,
                    x.Employee.FirstName,
                    x.StartTime,
                    x.EndTime,
                    x.DidEat,
                    x.NoteVn,
                    x.CongDoanSnapshot,
                    x.TaskNameSnapshot,
                    x.BlockCodeSnapshot,
                    x.ShiftTeamCodeSnapshot,
                    ReasonNameVn = x.OtForm.Reason.ReasonNameVn,
                    ReasonNameJp = x.OtForm.Reason.ReasonNameJp,
                    x.OtForm.SubReason,
                    x.OtForm.CreatedByUserName,
                    x.OtForm.CreatedAt,
                    DepartmentCode = x.OtForm.Department.DepartmentCode,
                });

            var employeeIds = entries.Select(e => e.EmployeeId).Distinct().ToList();
            var otFormIds = entries.Select(e => e.OtFormId).Distinct().ToList();

            var ledgerRows = employeeIds.Count == 0
                ? new List<(int EmployeeId, int Month, decimal TotalHours)>()
                : (await _unitOfWork.EmployeeAccumulationHistories.SelectAsync(
                    h => employeeIds.Contains(h.EmployeeId) && h.Year == date.Year,
                    h => new { h.EmployeeId, h.Month, h.TotalHours }))
                    .Select(h => (h.EmployeeId, h.Month, h.TotalHours))
                    .ToList();
            var ledgerByEmployee = ledgerRows.GroupBy(x => x.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

            // MNV_SC: last editor of that employee row in that form, from OtFormEditLog.
            var editLogs = otFormIds.Count == 0
                ? new List<(int OtFormId, int? EmployeeId, string ActionByUserName, DateTime ActionAt)>()
                : (await _unitOfWork.OtFormEditLogs.SelectAsync(
                    l => otFormIds.Contains(l.OtFormId) && l.EmployeeId != null && employeeIds.Contains(l.EmployeeId.Value),
                    l => new { l.OtFormId, l.EmployeeId, l.ActionByUserName, l.ActionAt }))
                    .Select(l => (l.OtFormId, l.EmployeeId, l.ActionByUserName, l.ActionAt))
                    .ToList();

            // Forms and edit logs store UserName only, so resolve UserName -> Employee.Code once for creators and editors.
            var userNamesToResolve = entries.Select(e => e.CreatedByUserName)
                .Concat(editLogs.Select(l => l.ActionByUserName))
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Distinct()
                .ToList();
            var employeeCodeByUserName = userNamesToResolve.Count == 0
                ? new Dictionary<string, string>()
                : (await _unitOfWork.Employees.SelectAsync(
                    e => e.UserName != null && userNamesToResolve.Contains(e.UserName),
                    e => new { e.UserName, e.Code }))
                    .Where(e => e.UserName != null)
                    .ToDictionary(e => e.UserName!, e => e.Code);

            // One row per person per day: earliest start / latest end; form-level fields are joined distinct across forms.
            var reportRows = entries
                .GroupBy(x => x.EmployeeId)
                .Select(g =>
                {
                    var first = g.First();
                    var ledger = ledgerByEmployee.TryGetValue(g.Key, out var rows) ? rows : new List<(int EmployeeId, int Month, decimal TotalHours)>();
                    var formIdsOfEmployee = g.Select(x => x.OtFormId).ToHashSet();
                    var latestEdit = editLogs
                        .Where(l => l.EmployeeId == g.Key && formIdsOfEmployee.Contains(l.OtFormId))
                        .OrderByDescending(l => l.ActionAt)
                        .FirstOrDefault();
                    var editorCode = latestEdit.ActionByUserName != null
                        && employeeCodeByUserName.TryGetValue(latestEdit.ActionByUserName, out var resolvedEditorCode)
                        ? resolvedEditorCode
                        : null;
                    var creatorCodes = g.Select(x => x.CreatedByUserName)
                        .Where(u => !string.IsNullOrWhiteSpace(u))
                        .Select(u => employeeCodeByUserName.TryGetValue(u, out var resolvedCreatorCode) ? resolvedCreatorCode : u)
                        .Distinct();

                    return new
                    {
                        EmployeeCode = first.EmployeeCode,
                        first.LastName,
                        first.FirstName,
                        CongDoan = g.Select(x => x.CongDoanSnapshot).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? UnknownLabel,
                        StartTime = g.Min(x => x.StartTime),
                        EndTime = g.Max(x => x.EndTime),
                        Reason = string.Join("; ", g.Select(x => x.ReasonNameVn).Distinct()),
                        ReasonJp = string.Join("; ", g.Select(x => x.ReasonNameJp).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        SubReason = string.Join("; ", g.Select(x => x.SubReason).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        DidEat = g.Any(x => x.DidEat),
                        Note = string.Join("; ", g.Select(x => x.NoteVn).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        TaskName = string.Join("; ", g.Select(x => x.TaskNameSnapshot).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        Block = string.Join("; ", g.Select(x => x.BlockCodeSnapshot).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        ShiftTeam = string.Join("; ", g.Select(x => x.ShiftTeamCodeSnapshot).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        LineMuon = string.Join("; ", g.Select(x =>
                            $"{(string.IsNullOrWhiteSpace(x.BlockCodeSnapshot) ? UnknownLabel : x.BlockCodeSnapshot)}-{(string.IsNullOrWhiteSpace(x.ShiftTeamCodeSnapshot) ? UnknownLabel : x.ShiftTeamCodeSnapshot)}")
                            .Distinct()),
                        TotalHours = g.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings)),
                        MonthToDate = ledger.Where(x => x.Month == date.Month).Sum(x => x.TotalHours),
                        YearToDate = ledger.Where(x => x.Month <= date.Month).Sum(x => x.TotalHours),
                        CreatorCode = string.Join("; ", creatorCodes),
                        EditorCode = editorCode,
                        DepartmentCode = string.Join("; ", g.Select(x => x.DepartmentCode).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        CreatedAt = g.Min(x => x.CreatedAt),
                    };
                })
                .OrderBy(x => x.EmployeeCode, StringComparer.OrdinalIgnoreCase)
                .ToList();

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("TongGioOT");

            // 23 columns matching the user-supplied template.
            string[] headers =
            {
                "MNV", "BOPHAN", "HO", "TEN", "Ngay_TC", "Gio_BD", "Gio_KT", "Lydo", "LYDO_JP", "Lydo_phu",
                "An", "CONGVIEC", "OT_Thang", "OT_Nam", "BLOCK", "NHOM", "NOTE", "Gio_Hienta", "Line_Muon",
                "MNV_LC", "MNV_SC", "BP", "Ngay_lap"
            };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            var rowIndex = 2;
            foreach (var item in reportRows)
            {
                sheet.Cell(rowIndex, 1).Value = item.EmployeeCode;
                sheet.Cell(rowIndex, 2).Value = item.CongDoan;
                sheet.Cell(rowIndex, 3).Value = item.LastName;
                sheet.Cell(rowIndex, 4).Value = item.FirstName;
                sheet.Cell(rowIndex, 5).Value = date.ToString("dd/MM/yyyy");
                sheet.Cell(rowIndex, 6).Value = item.StartTime.ToString("HH:mm");
                sheet.Cell(rowIndex, 7).Value = item.EndTime.ToString("HH:mm");
                sheet.Cell(rowIndex, 8).Value = item.Reason;
                sheet.Cell(rowIndex, 9).Value = item.ReasonJp;
                sheet.Cell(rowIndex, 10).Value = item.SubReason;
                sheet.Cell(rowIndex, 11).Value = item.DidEat;
                sheet.Cell(rowIndex, 12).Value = item.TaskName;
                sheet.Cell(rowIndex, 13).Value = item.MonthToDate;
                sheet.Cell(rowIndex, 14).Value = item.YearToDate;
                sheet.Cell(rowIndex, 15).Value = item.Block;
                sheet.Cell(rowIndex, 16).Value = item.ShiftTeam;
                sheet.Cell(rowIndex, 17).Value = item.Note;
                sheet.Cell(rowIndex, 18).Value = item.TotalHours;
                sheet.Cell(rowIndex, 19).Value = item.LineMuon;
                sheet.Cell(rowIndex, 20).Value = item.CreatorCode;
                sheet.Cell(rowIndex, 21).Value = item.EditorCode;
                sheet.Cell(rowIndex, 22).Value = item.DepartmentCode;
                sheet.Cell(rowIndex, 23).Value = item.CreatedAt.ToString("dd-MMM-yy", CultureInfo.InvariantCulture);
                rowIndex++;
            }

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName = $"TongGioTangCa_{date:yyyyMMdd}.xlsx";
            return (stream.ToArray(), fileName);
        }

        public async Task<(byte[] Content, string FileName)> ExportTimesReportAsync(DateOnly date, int? departmentId, int? workshopId = null)
        {
            var settings = await _attendanceSettingService.GetAsync();

            var entries = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.OtForm.IsProductionForm && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date == date && !x.IsRemoved
                     && (departmentId == null || x.OtForm.DepartmentId == departmentId)
                     && (workshopId == null || x.OtForm.WorkshopId == workshopId),
                x => new
                {
                    x.OtFormId,
                    x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    x.StartTime,
                    x.EndTime,
                    x.DidEat,
                    x.NoteVn,
                    x.BlockCodeSnapshot,
                    x.ShiftTeamCodeSnapshot,
                    DepartmentCode = x.OtForm.Department.DepartmentCode,
                });

            var employeeIds = entries.Select(e => e.EmployeeId).Distinct().ToList();
            var otFormIds = entries.Select(e => e.OtFormId).Distinct().ToList();

            // MNV_TP: code of the DepartmentManager who approved that form.
            var managerApprovals = otFormIds.Count == 0
                ? new Dictionary<int, string>()
                : (await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                    h => otFormIds.Contains(h.OtFormId) && h.Action == (int)ApprovalAction.Approved
                         && h.OtFormApprovalStep.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.DepartmentManager,
                    h => new { h.OtFormId, h.ApproverUserName }))
                    .GroupBy(h => h.OtFormId)
                    .ToDictionary(g => g.Key, g => g.First().ApproverUserName);

            var userNamesToResolve = managerApprovals.Values.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct().ToList();
            var employeeCodeByUserName = userNamesToResolve.Count == 0
                ? new Dictionary<string, string>()
                : (await _unitOfWork.Employees.SelectAsync(
                    e => e.UserName != null && userNamesToResolve.Contains(e.UserName),
                    e => new { e.UserName, e.Code }))
                    .Where(e => e.UserName != null)
                    .ToDictionary(e => e.UserName!, e => e.Code);

            // Per-person daily totals repeated on every row of that person (rows are not merged here).
            var dailyTotalsByEmployee = entries
                .GroupBy(x => x.EmployeeId)
                .ToDictionary(
                    g => g.Key,
                    g => (
                        TimesCount: g.Select(x => x.OtFormId).Distinct().Count(),
                        TotalHours: g.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings))
                    ));

            var reportRows = entries
                .Select(x =>
                {
                    var daily = dailyTotalsByEmployee[x.EmployeeId];
                    var managerCode = managerApprovals.TryGetValue(x.OtFormId, out var managerUserName)
                        && !string.IsNullOrWhiteSpace(managerUserName)
                        && employeeCodeByUserName.TryGetValue(managerUserName, out var resolvedManagerCode)
                        ? resolvedManagerCode
                        : null;
                    return new
                    {
                        x.EmployeeCode,
                        Block = string.IsNullOrWhiteSpace(x.BlockCodeSnapshot) ? UnknownLabel : x.BlockCodeSnapshot,
                        ShiftTeam = string.IsNullOrWhiteSpace(x.ShiftTeamCodeSnapshot) ? UnknownLabel : x.ShiftTeamCodeSnapshot,
                        x.NoteVn,
                        daily.TimesCount,
                        daily.TotalHours,
                        x.DepartmentCode,
                        ManagerCode = managerCode,
                        x.StartTime,
                    };
                })
                .OrderBy(x => x.EmployeeCode, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.StartTime)
                .ToList();

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("SoLuotTangCa");

            // 9 columns named exactly as in the user-supplied template.
            string[] headers = { "MNV", "BLOCK", "NHOM", "NOTE", "Ngay_TC", "LAN_TANG_CA_TRONG_NGAY", "Gio_Hientai", "BP", "MNV_TP" };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            var rowIndex = 2;
            foreach (var item in reportRows)
            {
                sheet.Cell(rowIndex, 1).Value = item.EmployeeCode;
                sheet.Cell(rowIndex, 2).Value = item.Block;
                sheet.Cell(rowIndex, 3).Value = item.ShiftTeam;
                sheet.Cell(rowIndex, 4).Value = item.NoteVn;
                sheet.Cell(rowIndex, 5).Value = date.ToString("dd/MM/yyyy");
                sheet.Cell(rowIndex, 6).Value = item.TimesCount;
                sheet.Cell(rowIndex, 7).Value = item.TotalHours;
                sheet.Cell(rowIndex, 8).Value = item.DepartmentCode;
                sheet.Cell(rowIndex, 9).Value = item.ManagerCode;
                rowIndex++;
            }

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName = await BuildRealFileNameAsync("Qry_So_lan_tang_Ca_trong_ngay_sx", date, departmentId);
            return (stream.ToArray(), fileName);
        }

        // 17 columns, one row per person per day; kept separate from ExportHoursReportAsync by user decision. Column order:
        // MNV/BOPHAN/HO/TEN/Ngay_TC/Gio_BD/Gio_KT/Lydo/Lydo_phu/An/BLOCK/NHOM/NOTE/Gio_Thuc_Te/BP/QUAN_LY_TC_SX/MNV_TP.
        public async Task<(byte[] Content, string FileName)> ExportQryExportExcelAsync(DateOnly date, int? departmentId, int? workshopId = null)
        {
            var settings = await _attendanceSettingService.GetAsync();
            var grouped = await BuildGroupedDailyRowsAsync(x => x.OtForm.IsProductionForm && x.OtForm.Date == date, departmentId, workshopId, settings);
            return (await BuildQryExportExcelAsync(grouped), await BuildRealFileNameAsync("Qry_EXPORT_EXCEL", date, departmentId));
        }

        // Same file for office forms: the picked groups (any name), or every Green/Orange group when none is picked.
        public async Task<(byte[] Content, string FileName)> ExportOfficeQryExportExcelAsync(DateOnly fromDate, DateOnly toDate, int? departmentId, int? workshopId = null, int[]? groupIds = null)
        {
            var settings = await _attendanceSettingService.GetAsync();
            var anyGroup = groupIds is not { Length: > 0 };
            var grouped = await BuildGroupedDailyRowsAsync(
                x => !x.OtForm.IsProductionForm && x.OtForm.Date >= fromDate && x.OtForm.Date <= toDate
                     && (anyGroup
                         ? x.OtForm.Group!.GroupNameVn.Contains("GREEN") || x.OtForm.Group.GroupNameVn.Contains("ORANGE")
                         : groupIds!.Contains(x.OtForm.GroupId!.Value)),
                departmentId, workshopId, settings);
            return (await BuildQryExportExcelAsync(grouped, isOffice: true), await BuildRealFileNameAsync("Qry_EXPORT_EXCEL", fromDate, departmentId, toDate));
        }

        public async Task<IReadOnlyList<ProductionOptionDto>> GetOfficeProductivityGroupsAsync(int? workshopId, int? departmentId)
        {
            var groups = await _unitOfWork.Groups.SelectAsync(
                x => !x.IsDeleted
                     && (!workshopId.HasValue || x.WorkshopId == workshopId) && (!departmentId.HasValue || x.DepartmentId == departmentId),
                x => new ProductionOptionDto { Id = x.Id, Code = x.GroupCode, NameVn = x.GroupNameVn });
            return groups.OrderBy(x => x.NameVn).ToList();
        }

        private async Task<byte[]> BuildQryExportExcelAsync(List<GroupedDailyRow> grouped, bool isOffice = false)
        {
            var otFormIds = grouped.SelectMany(x => x.OtFormIds).Distinct().ToList();

            // QUAN_LY_TC_SX: the "TL" step approver, or on office forms the last approver before the Manager; MNV_TP: the DepartmentManager step approver.
            var teamLeaderCodeByForm = isOffice
                ? await ResolveLastApproverBeforeManagerAsync(otFormIds)
                : await ResolveApprovalCodesByJobTitleCodeAsync(otFormIds, "TL");
            var managerCodeByForm = await ResolveApprovalCodesByTerminalLevelAsync(otFormIds, (int)JobTitleTerminalLevel.DepartmentManager);

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Qry_EXPORT_EXCEL");

            string[] headers =
            {
                "MNV", "BOPHAN", "HO", "TEN", "Ngay_TC", "Gio_BD", "Gio_KT", "Lydo", "Lydo_phu", "An",
                "BLOCK", "NHOM", "NOTE", "Gio_Thuc_Te", "BP", "QUAN_LY_TC_SX", "MNV_TP"
            };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            var rowIndex = 2;
            foreach (var item in grouped)
            {
                sheet.Cell(rowIndex, 1).Value = ExcelCodeCell.From(item.EmployeeCode);
                sheet.Cell(rowIndex, 2).Value = item.CongDoan;
                sheet.Cell(rowIndex, 3).Value = item.LastName;
                sheet.Cell(rowIndex, 4).Value = item.FirstName;
                sheet.Cell(rowIndex, 5).Value = item.Date.ToDateTime(TimeOnly.MinValue);
                sheet.Cell(rowIndex, 5).Style.DateFormat.Format = "dd-MMM-yy";
                sheet.Cell(rowIndex, 6).Value = item.StartTime.ToTimeSpan();
                sheet.Cell(rowIndex, 6).Style.DateFormat.Format = "h:mm";
                sheet.Cell(rowIndex, 7).Value = item.EndTime.ToTimeSpan();
                sheet.Cell(rowIndex, 7).Style.DateFormat.Format = "h:mm";
                sheet.Cell(rowIndex, 8).Value = item.Reason;
                sheet.Cell(rowIndex, 9).Value = item.SubReason;
                sheet.Cell(rowIndex, 10).Value = item.DidEat;
                sheet.Cell(rowIndex, 11).Value = item.Block;
                sheet.Cell(rowIndex, 12).Value = item.ShiftTeam;
                sheet.Cell(rowIndex, 13).Value = item.Note;
                sheet.Cell(rowIndex, 14).Value = item.TotalHours;
                sheet.Cell(rowIndex, 15).Value = item.DepartmentCode;
                sheet.Cell(rowIndex, 16).Value = ExcelCodeCell.From(ResolveDistinctCode(item.OtFormIds, teamLeaderCodeByForm));
                sheet.Cell(rowIndex, 17).Value = ExcelCodeCell.From(ResolveDistinctCode(item.OtFormIds, managerCodeByForm));
                rowIndex++;
            }

            foreach (var column in new[] { 1, 16, 17 })
                sheet.Range(2, column, Math.Max(rowIndex - 1, 2), column).Style.NumberFormat.Format = "00000";
            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }

        // 7-column summary; a separate report, not a reduced Qry_EXPORT_EXCEL.
        public async Task<(byte[] Content, string FileName)> ExportSumExportDataAsync(DateOnly date, int? departmentId, int? workshopId = null)
        {
            var settings = await _attendanceSettingService.GetAsync();
            var grouped = await BuildGroupedDailyRowsAsync(x => x.OtForm.IsProductionForm && x.OtForm.Date == date, departmentId, workshopId, settings);

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("SUM_EXPORT_DATA");

            string[] headers = { "MNV", "BOPHAN", "HO", "TEN", "Ngay_TC", "Gio_thuc_te", "BP" };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            var rowIndex = 2;
            foreach (var item in grouped)
            {
                sheet.Cell(rowIndex, 1).Value = item.EmployeeCode;
                sheet.Cell(rowIndex, 2).Value = item.CongDoan;
                sheet.Cell(rowIndex, 3).Value = item.LastName;
                sheet.Cell(rowIndex, 4).Value = item.FirstName;
                sheet.Cell(rowIndex, 5).Value = date.ToString("dd/MM/yyyy");
                sheet.Cell(rowIndex, 6).Value = item.TotalHours;
                sheet.Cell(rowIndex, 7).Value = item.DepartmentCode;
                rowIndex++;
            }

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName = await BuildRealFileNameAsync("SUM_EXPORT_DATA", date, departmentId);
            return (stream.ToArray(), fileName);
        }

        private sealed class GroupedDailyRow
        {
            public List<int> OtFormIds { get; set; } = new();
            public string EmployeeCode { get; set; } = null!;
            public DateOnly Date { get; set; }
            public string LastName { get; set; } = null!;
            public string FirstName { get; set; } = null!;
            public string CongDoan { get; set; } = null!;
            public TimeOnly StartTime { get; set; }
            public TimeOnly EndTime { get; set; }
            public string Reason { get; set; } = null!;
            public string SubReason { get; set; } = null!;
            public bool DidEat { get; set; }
            public string Note { get; set; } = null!;
            public string Block { get; set; } = null!;
            public string ShiftTeam { get; set; } = null!;
            public decimal TotalHours { get; set; }
            public string DepartmentCode { get; set; } = null!;
        }

        // Shared base for the per-person-per-day reports; ExportHoursReportAsync keeps its own grouping on purpose to avoid
        // touching stable logic, accepting some duplication.
        private async Task<List<GroupedDailyRow>> BuildGroupedDailyRowsAsync(Expression<Func<OtFormEmployee, bool>> scope, int? departmentId, int? workshopId, Dtos.AttendanceSettings.AttendanceSettingDto settings)
        {
            // Office forms created before they got a production snapshot read the employee's current production fields instead.
            var entries = await _unitOfWork.OtFormEmployees.ToListAsync(
                _unitOfWork.OtFormEmployees.GetQueryable().Where(scope).Where(
                    x => !x.OtForm.IsDeleted && x.OtForm.Status == (int)OtFormStatus.Completed && !x.IsRemoved
                         && (departmentId == null || x.OtForm.DepartmentId == departmentId)
                         && (workshopId == null || x.OtForm.WorkshopId == workshopId)),
                x => new
                {
                    x.OtFormId,
                    x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    x.Employee.LastName,
                    x.Employee.FirstName,
                    x.OtForm.Date,
                    x.StartTime,
                    x.EndTime,
                    x.DidEat,
                    x.NoteVn,
                    // Office staff are mostly not on the production roster; their group name stands in for the process.
                    CongDoanSnapshot = x.OtForm.IsProductionForm ? x.CongDoanSnapshot
                        : x.CongDoanSnapshot ?? x.Employee.CongDoan ?? x.OtForm.Group!.GroupNameVn,
                    BlockCodeSnapshot = x.OtForm.IsProductionForm ? x.BlockCodeSnapshot
                        : x.BlockCodeSnapshot ?? x.Employee.ProductionLine!.LineCode,
                    // Office: non-Green/Orange groups are always HC; Green/Orange use the roster, else G/O from the name.
                    ShiftTeamCodeSnapshot = x.OtForm.IsProductionForm ? x.ShiftTeamCodeSnapshot
                        : !x.OtForm.Group!.GroupNameVn.Contains("GREEN") && !x.OtForm.Group.GroupNameVn.Contains("ORANGE") ? "HC"
                        : x.ShiftTeamCodeSnapshot ?? x.Employee.ShiftTeam!.Code
                          ?? (x.OtForm.Group.GroupNameVn.Contains("GREEN") ? "G" : "O"),
                    ReasonNameVn = x.OtForm.Reason.ReasonNameVn,
                    x.OtForm.SubReason,
                    DepartmentCode = x.OtForm.Department.DepartmentCode,
                });

            return entries
                .GroupBy(x => new { x.EmployeeId, x.Date })
                .Select(g =>
                {
                    var first = g.First();
                    return new GroupedDailyRow
                    {
                        OtFormIds = g.Select(x => x.OtFormId).Distinct().ToList(),
                        EmployeeCode = first.EmployeeCode,
                        Date = first.Date,
                        LastName = first.LastName,
                        FirstName = first.FirstName,
                        CongDoan = g.Select(x => x.CongDoanSnapshot).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? UnknownLabel,
                        StartTime = g.Min(x => x.StartTime),
                        EndTime = g.Max(x => x.EndTime),
                        Reason = string.Join("; ", g.Select(x => x.ReasonNameVn).Distinct()),
                        SubReason = string.Join("; ", g.Select(x => x.SubReason).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        DidEat = g.Any(x => x.DidEat),
                        Note = string.Join("; ", g.Select(x => x.NoteVn).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        Block = string.Join("; ", g.Select(x => x.BlockCodeSnapshot).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        ShiftTeam = string.Join("; ", g.Select(x => x.ShiftTeamCodeSnapshot).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                        TotalHours = g.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings)),
                        DepartmentCode = string.Join("; ", g.Select(x => x.DepartmentCode).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct()),
                    };
                })
                .OrderBy(x => x.EmployeeCode, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.Date)
                .ToList();
        }

        // Approver codes per OtFormId for the step whose JobTitleCodeSnapshot matches.
        private async Task<Dictionary<int, string>> ResolveApprovalCodesByJobTitleCodeAsync(List<int> otFormIds, string jobTitleCode)
        {
            if (otFormIds.Count == 0) return new Dictionary<int, string>();

            var approvals = (await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => otFormIds.Contains(h.OtFormId) && h.Action == (int)ApprovalAction.Approved
                     && h.OtFormApprovalStep.JobTitleCodeSnapshot == jobTitleCode,
                h => new { h.OtFormId, h.ApproverUserName }))
                .GroupBy(h => h.OtFormId)
                .ToDictionary(g => g.Key, g => g.First().ApproverUserName);

            return await ResolveUserNamesToEmployeeCodesAsync(approvals);
        }

        // Steps run from the lowest rank up, so the highest approved step below the Manager levels is the one right before them.
        private async Task<Dictionary<int, string>> ResolveLastApproverBeforeManagerAsync(List<int> otFormIds)
        {
            if (otFormIds.Count == 0) return new Dictionary<int, string>();

            var approvals = (await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => otFormIds.Contains(h.OtFormId) && h.Action == (int)ApprovalAction.Approved && !h.OtFormApprovalStep.IsDeleted
                     && h.OtFormApprovalStep.TerminalLevelSnapshot == (int)JobTitleTerminalLevel.None,
                h => new { h.OtFormId, h.Id, h.OtFormApprovalStep.StepOrder, h.ApproverUserName }))
                .GroupBy(h => h.OtFormId)
                .ToDictionary(g => g.Key, g => g.OrderBy(h => h.StepOrder).ThenBy(h => h.Id).Last().ApproverUserName);

            return await ResolveUserNamesToEmployeeCodesAsync(approvals);
        }

        // Same, filtered by TerminalLevelSnapshot.
        private async Task<Dictionary<int, string>> ResolveApprovalCodesByTerminalLevelAsync(List<int> otFormIds, int terminalLevel)
        {
            if (otFormIds.Count == 0) return new Dictionary<int, string>();

            var approvals = (await _unitOfWork.OtFormApprovalHistories.SelectAsync(
                h => otFormIds.Contains(h.OtFormId) && h.Action == (int)ApprovalAction.Approved
                     && h.OtFormApprovalStep.TerminalLevelSnapshot == terminalLevel,
                h => new { h.OtFormId, h.ApproverUserName }))
                .GroupBy(h => h.OtFormId)
                .ToDictionary(g => g.Key, g => g.First().ApproverUserName);

            return await ResolveUserNamesToEmployeeCodesAsync(approvals);
        }

        private async Task<Dictionary<int, string>> ResolveUserNamesToEmployeeCodesAsync(Dictionary<int, string> approverUserNameByOtFormId)
        {
            var userNames = approverUserNameByOtFormId.Values.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct().ToList();
            var employeeCodeByUserName = userNames.Count == 0
                ? new Dictionary<string, string>()
                : (await _unitOfWork.Employees.SelectAsync(
                    e => e.UserName != null && userNames.Contains(e.UserName),
                    e => new { e.UserName, e.Code }))
                    .Where(e => e.UserName != null)
                    .ToDictionary(e => e.UserName!, e => e.Code);

            return approverUserNameByOtFormId
                .Where(kv => !string.IsNullOrWhiteSpace(kv.Value) && employeeCodeByUserName.ContainsKey(kv.Value))
                .ToDictionary(kv => kv.Key, kv => employeeCodeByUserName[kv.Value]);
        }

        // A person may have several forms per day; differing approver codes are joined with "; ".
        private static string? ResolveDistinctCode(List<int> otFormIds, Dictionary<int, string> codeByOtFormId)
        {
            var codes = otFormIds.Where(codeByOtFormId.ContainsKey).Select(id => codeByOtFormId[id]).Distinct().ToList();
            return codes.Count == 0 ? null : string.Join("; ", codes);
        }

        // File name format "{QueryName}_{yyyy-MM-d}_{DeptCode}.xlsx" (day without leading zero); suffix omitted when not
        // filtered by department. A range appends "_{toDate}".
        private async Task<string> BuildRealFileNameAsync(string queryName, DateOnly date, int? departmentId, DateOnly? toDate = null)
        {
            var datePart = date.ToString("yyyy-MM-d") + (toDate > date ? $"_{toDate:yyyy-MM-d}" : "");
            var suffix = "";
            if (departmentId.HasValue)
            {
                var department = await _unitOfWork.Departments.GetByIdAsync(departmentId.Value);
                if (department != null) suffix = $"_{department.DepartmentCode}";
            }
            return $"{queryName}_{datePart}{suffix}.xlsx";
        }

        public async Task<List<ProductionTicketBatchGroupDto>> GetTicketBatchAsync(DateOnly date, int? departmentId, int? workshopId = null)
        {
            var settings = await _attendanceSettingService.GetAsync();
            var entries = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.OtForm.IsProductionForm && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date == date && !x.IsRemoved
                     && (departmentId == null || x.OtForm.DepartmentId == departmentId)
                     && (workshopId == null || x.OtForm.WorkshopId == workshopId),
                x => new
                {
                    x.OtFormId,
                    x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    FullName = x.Employee.LastName + " " + x.Employee.FirstName,
                    x.StartTime,
                    x.EndTime,
                    x.NoteVn,
                    // Use the snapshot frozen on OtFormEmployee, as the single-form print does; the live ledger would differ from
                    // the figures signed on the form.
                    x.MonthToDate,
                    x.YearToDate,
                    x.DidEat,
                    x.CongDoanSnapshot,
                    x.TaskNameSnapshot,
                    x.TeamCodeSnapshot,
                    x.BlockCodeSnapshot,
                    x.ShiftTeamCodeSnapshot,
                    FormStartTime = x.OtForm.StartTime,
                    FormEndTime = x.OtForm.EndTime,
                });

            // Same grouping as GetTicketReportAsync, but at OtFormEmployee level to list each person.
            var groups = entries
                .GroupBy(x => new { x.CongDoanSnapshot, x.TeamCodeSnapshot, x.BlockCodeSnapshot, x.ShiftTeamCodeSnapshot, x.FormStartTime, x.FormEndTime })
                .Select(g => new ProductionTicketBatchGroupDto
                {
                    PrimaryOtFormId = g.Select(x => x.OtFormId).Min(),
                    Block = string.IsNullOrWhiteSpace(g.Key.BlockCodeSnapshot) ? UnknownLabel : g.Key.BlockCodeSnapshot!,
                    ShiftTeam = string.IsNullOrWhiteSpace(g.Key.ShiftTeamCodeSnapshot) ? UnknownLabel : g.Key.ShiftTeamCodeSnapshot!,
                    EmployeeCount = g.Select(x => x.EmployeeId).Distinct().Count(),
                    // Keep EmployeeId order to match the single-form print (no OrderBy there).
                    Employees = g
                        .GroupBy(x => x.EmployeeId)
                        .OrderBy(eg => eg.Key)
                        .Select(eg =>
                        {
                            var first = eg.First();
                            return new ProductionTicketBatchEmployeeDto
                            {
                                EmployeeId = eg.Key,
                                EmployeeCode = first.EmployeeCode,
                                FullName = first.FullName,
                                StartTime = first.StartTime,
                                EndTime = eg.Max(x => x.EndTime),
                                // Same as the single-form print: the stored total excludes this day's hours, the paper includes them.
                                MonthToDate = first.MonthToDate + eg.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings)),
                                YearToDate = first.YearToDate + eg.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings)),
                                NoteVn = eg.Select(x => x.NoteVn).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)),
                                CongDoanSnapshot = first.CongDoanSnapshot,
                                TaskNameSnapshot = first.TaskNameSnapshot,
                                BlockCodeSnapshot = first.BlockCodeSnapshot,
                                TeamCodeSnapshot = first.TeamCodeSnapshot,
                                ShiftTeamCodeSnapshot = first.ShiftTeamCodeSnapshot,
                            };
                        })
                        .ToList(),
                })
                .OrderBy(x => x.Block, StringComparer.OrdinalIgnoreCase)
                .ThenBy(x => x.ShiftTeam, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return groups;
        }

        private static string ResolveCa(TimeOnly startTime, TimeOnly endTime)
        {
            foreach (var window in ShiftWindows)
            {
                if (startTime >= window.Start && endTime <= window.End) return window.Code;
            }
            return OtherShiftLabel;
        }
    }
}
