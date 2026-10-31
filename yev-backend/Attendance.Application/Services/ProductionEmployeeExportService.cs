using Attendance.Application.Interfaces.Service;
using ClosedXML.Excel;
using Shared.Application.Helper;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    // Mirrors the column layout of Import_Nhan_Su_Che_Tao.xlsx so the export can be re-imported next month; one sheet per
    // real system department (not the file's BOPHAN). Column A (KHOI SU) stays empty because it is not stored yet.
    public class ProductionEmployeeExportService : BaseService<IAttendanceUnitOfWork>, IProductionEmployeeExportService
    {
        private const string UnknownDepartmentLabel = "Chưa xác định";
        private readonly IDepartmentAccessGuard _departmentAccessGuard;

        // Columns A..O of the template; empty L/M/N keep LEADER in column O.
        private static readonly string[] Headers =
        {
            "KHOI SU", "MNV", "BOPHAN", "HO", "TEN", "CÔNG VIỆC", "OT month", "OT year",
            "BLOCK", "NHOM", "GROUP", "", "", "", "LEADER"
        };

        public ProductionEmployeeExportService(IAttendanceUnitOfWork unitOfWork, IDepartmentAccessGuard departmentAccessGuard)
            : base(unitOfWork)
        {
            _departmentAccessGuard = departmentAccessGuard;
        }

        public async Task<(byte[] Content, string FileName)> ExportAsync(string callerUserName, bool isAdmin)
        {
            // Unresolved rows (no Employee, hence no department) are already excluded by the EmployeeId filter.
            var managedDepartmentIds = isAdmin ? null : await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);

            var rows = await _unitOfWork.ProductionEmployees.SelectAsync(
                x => !x.IsDeleted && x.EmployeeId != null
                    && (managedDepartmentIds == null || (x.Employee != null && (
                        (x.Employee.DepartmentId != null && managedDepartmentIds.Contains(x.Employee.DepartmentId.Value))
                        || (x.Employee.Group != null && managedDepartmentIds.Contains(x.Employee.Group.DepartmentId))))),
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

                    // Column A (KHOI SU) intentionally empty.
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

        // Excel sheet names: max 31 chars, no \ / ? * [ ] :, unique per workbook.
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
