using System.Globalization;
using Attendance.Application.Dtos.Reports;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    // 2 báo cáo theo ngày cho đơn "dưới chuyền" đã Hoàn tất (docs/Note_OT.txt mục 1 dòng 10 và mục 2),
    // chốt thiết kế với người dùng 2026-08-28 — xem lịch sử trao đổi trong docs/attendance-module.md
    // §Báo cáo dưới chuyền khi cập nhật doc. Chỉ tính đơn IsProductionForm=true, Status=Completed
    // (đã qua đủ mọi cấp duyệt, không chỉ riêng Trưởng phòng — người dùng xác nhận "đơn phải trạng
    // thái hoàn tất thì mới được tính vào").
    public class ProductionOtReportService : BaseService<IAttendanceUnitOfWork>, IProductionOtReportService
    {
        private const string UnknownLabel = "Chưa xác định";
        private const string OtherShiftLabel = "Khac";

        // Khung giờ CA cố định (2026-08-28, theo người dùng) — 1 đơn khớp CA nào khi StartTime/EndTime
        // nằm TRỌN trong khung đó (không phải trùng khớp tuyệt đối, vì người về sớm/vào trễ vẫn thuộc
        // đúng CA gốc — vd 19:30-22:00 vẫn là CA C dù không bắt đầu đúng 18:00).
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

        public async Task<ProductionTicketReportDto> GetTicketReportAsync(DateOnly date, int? departmentId)
        {
            var forms = await _unitOfWork.OtForms.SelectAsync(
                x => x.IsProductionForm && !x.IsDeleted && x.Status == (int)OtFormStatus.Completed && x.Date == date
                     && (departmentId == null || x.DepartmentId == departmentId),
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

            // Nhóm theo đúng tổ hợp (Công đoạn, Team, Line-Nhóm màu, khung giờ CHÍNH XÁC) — KHÔNG chỉ
            // theo (Công đoạn, CA, Team, Line_ca) vì 1 Line/CA có thể có nhiều dòng khác nhau do người
            // về sớm/vào trễ khác giờ nhau (khớp đúng cách hệ cũ tách dòng trong file mẫu 22-08.xlsx).
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

        public async Task<(byte[] Content, string FileName)> ExportHoursReportAsync(DateOnly date, int? departmentId)
        {
            var settings = await _attendanceSettingService.GetAsync();

            var entries = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.OtForm.IsProductionForm && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date == date && !x.IsRemoved
                     && (departmentId == null || x.OtForm.DepartmentId == departmentId),
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

            // MNV_SC (2026-08-29, theo yêu cầu bổ sung) — người sửa gần nhất của ĐÚNG dòng nhân viên đó
            // trong ĐÚNG đơn đó, tra qua OtFormEditLog (bảng nhật ký sửa đơn, xem OtFormEditLog.cs).
            var editLogs = otFormIds.Count == 0
                ? new List<(int OtFormId, int? EmployeeId, string ActionByUserName, DateTime ActionAt)>()
                : (await _unitOfWork.OtFormEditLogs.SelectAsync(
                    l => otFormIds.Contains(l.OtFormId) && l.EmployeeId != null && employeeIds.Contains(l.EmployeeId.Value),
                    l => new { l.OtFormId, l.EmployeeId, l.ActionByUserName, l.ActionAt }))
                    .Select(l => (l.OtFormId, l.EmployeeId, l.ActionByUserName, l.ActionAt))
                    .ToList();

            // MNV_LC/MNV_SC cần mã nhân viên (Employee.Code), nhưng OtForm/OtFormEditLog chỉ lưu
            // UserName người thao tác (không lưu numeric UserId, xem OtForm.CreatedByUserName) — tra
            // 1 lượt duy nhất UserName -> Code cho cả người lập lẫn người sửa.
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

            // Gộp 1 dòng/người/ngày (2026-08-28, theo người dùng — báo cáo "số LƯỢT tăng ca" là báo
            // cáo khác, riêng biệt, chưa làm ở đây). Giờ bắt đầu/kết thúc lấy khung sớm nhất/muộn nhất
            // trong ngày; các field theo ĐƠN (Lý do/Công việc/Block/Nhóm/Line mượn/Người lập/Bộ phận)
            // gộp distinct nếu người đó có nhiều lượt khác đơn trong ngày.
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

            // Đặt tên cột + đủ 23 cột khớp đúng file mẫu người dùng gửi lại 2026-08-29 (ảnh chụp export
            // gốc, đầy đủ hơn bản 13 cột đợt trước). Không đổi Ý NGHĨA cột đã chốt (vẫn gộp 1 dòng/
            // người/ngày), chỉ bổ sung các cột còn thiếu.
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

        public async Task<(byte[] Content, string FileName)> ExportTimesReportAsync(DateOnly date, int? departmentId)
        {
            var settings = await _attendanceSettingService.GetAsync();

            var entries = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.OtForm.IsProductionForm && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date == date && !x.IsRemoved
                     && (departmentId == null || x.OtForm.DepartmentId == departmentId),
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

            // MNV_TP — mã Trưởng phòng đã DUYỆT (Approved) đúng đơn đó, tra qua bước duyệt cấp
            // DepartmentManager (JobTitleTerminalLevel.DepartmentManager) của từng OtForm — 2026-08-29,
            // theo yêu cầu người dùng, cùng cách tra MNV_LC/MNV_SC ở ExportHoursReportAsync.
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

            // Tổng hợp CẢ NGÀY theo từng người (số lượt + tổng giờ) — lặp lại giống nhau trên mọi dòng
            // của người đó (KHÔNG gộp dòng, khác ExportHoursReportAsync — xem docs §Số lượt tăng ca).
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

            // Đủ 9 cột khớp file mẫu người dùng gửi (Qry_So_lan_tang_Ca_trong_ngay_sx...xlsx) — chỉ có
            // dòng tiêu đề, không có dữ liệu mẫu, nên thứ tự/tên cột lấy nguyên văn từ đó.
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

        // "Qry_EXPORT_EXCEL" (2026-09-03c) — 17 cột, gộp 1 dòng/người/ngày, ĐỘC LẬP với
        // ExportHoursReportAsync (23 cột, người dùng xác nhận giữ nguyên cả 2, không gộp/thay thế nhau
        // dù cùng kiểu gộp/người/ngày). Thứ tự cột đúng nguyên văn file thật:
        // MNV/BOPHAN/HO/TEN/Ngay_TC/Gio_BD/Gio_KT/Lydo/Lydo_phu/An/BLOCK/NHOM/NOTE/Gio_Thuc_Te/BP/
        // QUAN_LY_TC_SX/MNV_TP.
        public async Task<(byte[] Content, string FileName)> ExportQryExportExcelAsync(DateOnly date, int? departmentId)
        {
            var settings = await _attendanceSettingService.GetAsync();
            var grouped = await BuildGroupedDailyRowsAsync(date, departmentId, settings);
            var otFormIds = grouped.SelectMany(x => x.OtFormIds).Distinct().ToList();

            // QUAN_LY_TC_SX — mã nhân viên đã DUYỆT (Approved) ở bước Chức vụ "TL" (Team Leader,
            // JobTitles.Code="TL") — người dùng xác nhận 2026-09-03c ("MNV team leader"). MNV_TP — cùng
            // cơ chế đã có ở ExportTimesReportAsync (bước TerminalLevel=DepartmentManager), tách hàm
            // dùng chung ResolveApprovalCodesByJobTitleCodeAsync/ResolveApprovalCodesByTerminalLevelAsync
            // ở dưới để không lặp code.
            var teamLeaderCodeByForm = await ResolveApprovalCodesByJobTitleCodeAsync(otFormIds, "TL");
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
                var teamLeaderCode = ResolveDistinctCode(item.OtFormIds, teamLeaderCodeByForm);
                var managerCode = ResolveDistinctCode(item.OtFormIds, managerCodeByForm);

                sheet.Cell(rowIndex, 1).Value = item.EmployeeCode;
                sheet.Cell(rowIndex, 2).Value = item.CongDoan;
                sheet.Cell(rowIndex, 3).Value = item.LastName;
                sheet.Cell(rowIndex, 4).Value = item.FirstName;
                sheet.Cell(rowIndex, 5).Value = date.ToString("dd/MM/yyyy");
                sheet.Cell(rowIndex, 6).Value = item.StartTime.ToString("HH:mm");
                sheet.Cell(rowIndex, 7).Value = item.EndTime.ToString("HH:mm");
                sheet.Cell(rowIndex, 8).Value = item.Reason;
                sheet.Cell(rowIndex, 9).Value = item.SubReason;
                sheet.Cell(rowIndex, 10).Value = item.DidEat;
                sheet.Cell(rowIndex, 11).Value = item.Block;
                sheet.Cell(rowIndex, 12).Value = item.ShiftTeam;
                sheet.Cell(rowIndex, 13).Value = item.Note;
                sheet.Cell(rowIndex, 14).Value = item.TotalHours;
                sheet.Cell(rowIndex, 15).Value = item.DepartmentCode;
                sheet.Cell(rowIndex, 16).Value = teamLeaderCode;
                sheet.Cell(rowIndex, 17).Value = managerCode;
                rowIndex++;
            }

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName = await BuildRealFileNameAsync("Qry_EXPORT_EXCEL", date, departmentId);
            return (stream.ToArray(), fileName);
        }

        // "SUM_EXPORT_DATA" (2026-09-03c) — 7 cột, bản tóm tắt riêng biệt (KHÔNG phải rút gọn của
        // Qry_EXPORT_EXCEL — người dùng xác nhận 2 báo cáo phục vụ 2 mục đích khác nhau).
        public async Task<(byte[] Content, string FileName)> ExportSumExportDataAsync(DateOnly date, int? departmentId)
        {
            var settings = await _attendanceSettingService.GetAsync();
            var grouped = await BuildGroupedDailyRowsAsync(date, departmentId, settings);

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

        // Nền chung cho 3 báo cáo "gộp 1 dòng/người/ngày" (ExportQryExportExcelAsync/
        // ExportSumExportDataAsync) — KHÔNG dùng lại cho ExportHoursReportAsync (23 cột, đã chốt trước
        // đó, có thêm lũy kế Tháng/Năm + MNV_LC/MNV_SC không cần ở đây) để tránh đụng logic đang chạy
        // ổn định — chấp nhận trùng 1 phần logic gộp giữa 2 nơi.
        private async Task<List<GroupedDailyRow>> BuildGroupedDailyRowsAsync(DateOnly date, int? departmentId, Dtos.AttendanceSettings.AttendanceSettingDto settings)
        {
            var entries = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.OtForm.IsProductionForm && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date == date && !x.IsRemoved
                     && (departmentId == null || x.OtForm.DepartmentId == departmentId),
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
                    x.BlockCodeSnapshot,
                    x.ShiftTeamCodeSnapshot,
                    ReasonNameVn = x.OtForm.Reason.ReasonNameVn,
                    x.OtForm.SubReason,
                    DepartmentCode = x.OtForm.Department.DepartmentCode,
                });

            return entries
                .GroupBy(x => x.EmployeeId)
                .Select(g =>
                {
                    var first = g.First();
                    return new GroupedDailyRow
                    {
                        OtFormIds = g.Select(x => x.OtFormId).Distinct().ToList(),
                        EmployeeCode = first.EmployeeCode,
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
                .OrderBy(x => x.EmployeeCode, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        // Mã nhân viên đã DUYỆT (Approved) đúng OtForm đó ở bước có JobTitleCodeSnapshot khớp — dùng
        // cho QUAN_LY_TC_SX (lọc "TL"). Trả về theo OtFormId để chỗ gọi tự resolve theo nhóm/người.
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

        // Cùng cơ chế nhưng lọc theo TerminalLevelSnapshot (dùng cho MNV_TP — bước Trưởng phòng, mirror
        // ExportTimesReportAsync).
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

        // 1 người có thể có nhiều OtForm/ngày — nếu mã người duyệt khác nhau giữa các đơn thì gộp
        // distinct bằng "; " (hiếm, cùng nguyên tắc join các field cấp-đơn khác trong module).
        private static string? ResolveDistinctCode(List<int> otFormIds, Dictionary<int, string> codeByOtFormId)
        {
            var codes = otFormIds.Where(codeByOtFormId.ContainsKey).Select(id => codeByOtFormId[id]).Distinct().ToList();
            return codes.Count == 0 ? null : string.Join("; ", codes);
        }

        // Tên file ĐÚNG quy tắc thật (2026-09-03c, xem docs/Data/Reports/): "{TenQuery}_{yyyy-MM-d}_
        // {MaPhongBan}.xlsx" — ngày KHÔNG có số 0 đầu ở phần ngày (dùng đặc tả "d", KHÁC "dd"). Không
        // lọc theo Phòng ban (departmentId=null) thì bỏ hẳn phần hậu tố mã Phòng ban.
        private async Task<string> BuildRealFileNameAsync(string queryName, DateOnly date, int? departmentId)
        {
            var datePart = date.ToString("yyyy-MM-d");
            var suffix = "";
            if (departmentId.HasValue)
            {
                var department = await _unitOfWork.Departments.GetByIdAsync(departmentId.Value);
                if (department != null) suffix = $"_{department.DepartmentCode}";
            }
            return $"{queryName}_{datePart}{suffix}.xlsx";
        }

        public async Task<List<ProductionTicketBatchGroupDto>> GetTicketBatchAsync(DateOnly date, int? departmentId)
        {
            var entries = await _unitOfWork.OtFormEmployees.SelectAsync(
                x => x.OtForm.IsProductionForm && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed && x.OtForm.Date == date && !x.IsRemoved
                     && (departmentId == null || x.OtForm.DepartmentId == departmentId),
                x => new
                {
                    x.OtFormId,
                    x.EmployeeId,
                    EmployeeCode = x.Employee.Code,
                    FullName = x.Employee.LastName + " " + x.Employee.FirstName,
                    x.StartTime,
                    x.EndTime,
                    x.NoteVn,
                    // MonthToDate/YearToDate: LẤY ĐÚNG snapshot đã đóng băng trên OtFormEmployee (y hệt
                    // OtFormService.GetOtFormByIdAsync đang trả cho bản in đơn lẻ) — KHÔNG tự tính lại từ
                    // EmployeeAccumulationHistory (bản trước làm vậy, ra số khác hẳn con số đã ký trên đơn
                    // thật vì ledger là số SỐNG tại thời điểm xuất báo cáo, còn cột này mới là số ĐÚNG lúc
                    // lập đơn — lỗi người dùng báo 2026-09-03: bản xuất zip ra lũy kế khác bản in đơn).
                    x.MonthToDate,
                    x.YearToDate,
                    x.CongDoanSnapshot,
                    x.TaskNameSnapshot,
                    x.TeamCodeSnapshot,
                    x.BlockCodeSnapshot,
                    x.ShiftTeamCodeSnapshot,
                    FormStartTime = x.OtForm.StartTime,
                    FormEndTime = x.OtForm.EndTime,
                });

            // Cùng tổ hợp gộp với GetTicketReportAsync (Công đoạn/Team/Line-Nhóm màu/khung giờ CHÍNH
            // XÁC của đơn) — chỉ khác là gộp ở cấp OtFormEmployee để lấy được danh sách TỪNG người thay
            // vì chỉ đếm số lượng như báo cáo pivot.
            var groups = entries
                .GroupBy(x => new { x.CongDoanSnapshot, x.TeamCodeSnapshot, x.BlockCodeSnapshot, x.ShiftTeamCodeSnapshot, x.FormStartTime, x.FormEndTime })
                .Select(g => new ProductionTicketBatchGroupDto
                {
                    PrimaryOtFormId = g.Select(x => x.OtFormId).Min(),
                    Block = string.IsNullOrWhiteSpace(g.Key.BlockCodeSnapshot) ? UnknownLabel : g.Key.BlockCodeSnapshot!,
                    ShiftTeam = string.IsNullOrWhiteSpace(g.Key.ShiftTeamCodeSnapshot) ? UnknownLabel : g.Key.ShiftTeamCodeSnapshot!,
                    EmployeeCount = g.Select(x => x.EmployeeId).Distinct().Count(),
                    // Giữ nguyên thứ tự EmployeeId (khớp thứ tự tự nhiên OtFormEmployees.FindWithIncludesAsync
                    // đang trả cho bản in đơn lẻ — không có OrderBy) thay vì sắp lại theo EmployeeCode như
                    // bản trước (khiến thứ tự danh sách nhân viên khác hẳn bản in đơn — cùng lỗi báo cáo
                    // 2026-09-03).
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
                                MonthToDate = first.MonthToDate,
                                YearToDate = first.YearToDate,
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
