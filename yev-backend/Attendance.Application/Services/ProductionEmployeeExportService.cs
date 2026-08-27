using Attendance.Application.Interfaces.Service;
using ClosedXML.Excel;
using Shared.Application.Helper;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    // Xuất "Nhân sự dưới chuyền" (ProductionEmployee) ra .xlsx theo ĐÚNG vị trí cột của file mẫu
    // Import_Nhan_Su_Che_Tao.xlsx (sheet OT(N+1): A=KHOI SU, B=MNV, C=BOPHAN, D=HO, E=TEN, F=CÔNG VIỆC,
    // G=OT month, H=OT year, I=BLOCK, J=NHOM, K=GROUP, O=LEADER — xem ProductionEmployeeImportService.
    // ParseXlsx) để file xuất ra dùng lại được ngay làm file nhập tháng sau (2026-08-27, theo yêu cầu
    // người dùng), 1 sheet / Phòng ban THẬT của hệ thống (Employee.Group.Department — KHÁC cột BOPHAN
    // trong file gốc, vốn không gắn gì với Department thật). Cột OT month/OT year lấy SỐNG từ
    // EmployeeAccumulationHistory tại thời điểm xuất. Cột KHOI SU (A) để trống — hệ thống chưa lưu dữ
    // liệu này (xem docs §Import nhân sự dưới chuyền, mục còn thiếu).
    public class ProductionEmployeeExportService : BaseService<IAttendanceUnitOfWork>, IProductionEmployeeExportService
    {
        private const string UnknownDepartmentLabel = "Chưa xác định";

        // Đúng vị trí cột A..O của file mẫu — cột rỗng (L/M/N) giữ chỗ để LEADER rơi đúng cột O.
        private static readonly string[] Headers =
        {
            "KHOI SU", "MNV", "BOPHAN", "HO", "TEN", "CÔNG VIỆC", "OT month", "OT year",
            "BLOCK", "NHOM", "GROUP", "", "", "", "LEADER"
        };

        public ProductionEmployeeExportService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<(byte[] Content, string FileName)> ExportAsync()
        {
            var rows = await _unitOfWork.ProductionEmployees.SelectAsync(
                x => !x.IsDeleted && x.EmployeeId != null,
                x => new
                {
                    EmployeeId = x.EmployeeId!.Value,
                    EmployeeCode = x.Employee!.Code,
                    x.Employee!.LastName,
                    x.Employee!.FirstName,
                    CongDoan = x.CongDoan,
                    TaskName = x.TaskName,
                    BlockCode = x.BlockCode,
                    TeamCode = x.TeamCode,
                    ShiftTeamCode = x.ShiftTeamCode,
                    x.IsLeader,
                    DepartmentName = x.Employee!.Group != null && x.Employee!.Group!.Department != null
                        ? x.Employee!.Group!.Department!.DepartmentNameVn
                        : null
                });

            var now = TimeHelper.GetCurrentUtcTime();
            var todayYear = now.Year;
            var todayMonth = now.Month;

            var employeeIds = rows.Select(x => x.EmployeeId).Distinct().ToList();
            var ledgerRows = employeeIds.Count == 0
                ? new List<(int EmployeeId, int Month, decimal TotalHours)>()
                : (await _unitOfWork.EmployeeAccumulationHistories.SelectAsync(
                    x => employeeIds.Contains(x.EmployeeId) && x.Year == todayYear,
                    x => new { x.EmployeeId, x.Month, x.TotalHours }))
                    .Select(x => (x.EmployeeId, x.Month, x.TotalHours))
                    .ToList();

            var ledgerByEmployee = ledgerRows.GroupBy(x => x.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

            using var workbook = new XLWorkbook();
            var usedSheetNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var groupedByDepartment = rows
                .GroupBy(x => string.IsNullOrWhiteSpace(x.DepartmentName) ? UnknownDepartmentLabel : x.DepartmentName!)
                .OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase);

            foreach (var departmentGroup in groupedByDepartment)
            {
                var sheet = workbook.Worksheets.Add(MakeUniqueSheetName(departmentGroup.Key, usedSheetNames));

                for (var col = 0; col < Headers.Length; col++)
                    sheet.Cell(1, col + 1).Value = Headers[col];
                sheet.Row(1).Style.Font.Bold = true;

                var rowIndex = 2;
                foreach (var item in departmentGroup.OrderBy(x => x.EmployeeCode, StringComparer.OrdinalIgnoreCase))
                {
                    var monthHours = ledgerByEmployee.TryGetValue(item.EmployeeId, out var employeeLedger)
                        ? employeeLedger.Where(x => x.Month == todayMonth).Sum(x => x.TotalHours)
                        : 0m;
                    var yearHours = employeeLedger?.Where(x => x.Month <= todayMonth).Sum(x => x.TotalHours) ?? 0m;

                    // Cột A (KHOI SU) để trống có chủ đích — xem ghi chú đầu class.
                    sheet.Cell(rowIndex, 2).Value = item.EmployeeCode;
                    sheet.Cell(rowIndex, 3).Value = item.CongDoan;
                    sheet.Cell(rowIndex, 4).Value = item.LastName;
                    sheet.Cell(rowIndex, 5).Value = item.FirstName;
                    sheet.Cell(rowIndex, 6).Value = item.TaskName;
                    sheet.Cell(rowIndex, 7).Value = monthHours;
                    sheet.Cell(rowIndex, 8).Value = yearHours;
                    sheet.Cell(rowIndex, 9).Value = item.BlockCode;
                    sheet.Cell(rowIndex, 10).Value = item.ShiftTeamCode;
                    sheet.Cell(rowIndex, 11).Value = item.TeamCode;
                    sheet.Cell(rowIndex, 15).Value = item.IsLeader ? 1 : (int?)null;
                    rowIndex++;
                }

                sheet.Columns().AdjustToContents();
            }

            if (workbook.Worksheets.Count == 0)
                workbook.Worksheets.Add(UnknownDepartmentLabel);

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName = $"NhanSuDuoiChuyen_{now:yyyyMMdd_HHmm}.xlsx";
            return (stream.ToArray(), fileName);
        }

        // Tên sheet Excel: tối đa 31 ký tự, không được chứa \ / ? * [ ] : — và phải duy nhất trong
        // cùng 1 workbook (thêm hậu tố số nếu trùng sau khi cắt bớt/thay ký tự cấm).
        private static string MakeUniqueSheetName(string rawName, HashSet<string> usedNames)
        {
            var sanitized = new string(rawName.Select(c => "\\/?*[]:".Contains(c) ? '-' : c).ToArray()).Trim();
            if (string.IsNullOrWhiteSpace(sanitized)) sanitized = UnknownDepartmentLabel;
            if (sanitized.Length > 31) sanitized = sanitized[..31];

            var candidate = sanitized;
            var suffix = 1;
            while (!usedNames.Add(candidate))
            {
                var suffixText = $" ({++suffix})";
                var maxBaseLength = 31 - suffixText.Length;
                candidate = (sanitized.Length > maxBaseLength ? sanitized[..maxBaseLength] : sanitized) + suffixText;
            }

            return candidate;
        }
    }
}
