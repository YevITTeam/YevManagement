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

            var fileName = $"SoLuotTangCa_{date:yyyyMMdd}.xlsx";
            return (stream.ToArray(), fileName);
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
