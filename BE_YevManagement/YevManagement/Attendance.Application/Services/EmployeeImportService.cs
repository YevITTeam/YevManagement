using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using ClosedXML.Excel;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Import hàng loạt Employee (upsert theo Code — Code là unique: mã đã tồn tại thì cập nhật lại
    // FirstName/LastName/GroupId, mã chưa có thì tạo mới) kèm tự tạo Department/Group nếu mã chưa
    // tồn tại (dữ liệu nhân sự thật thường liệt kê Department/Group ngay trên cùng dòng nhân viên,
    // không có file riêng).
    public class EmployeeImportService : BaseService<IAttendanceUnitOfWork>, IEmployeeImportService
    {
        public EmployeeImportService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream)
        {
            var rawRows = ParseXlsx(excelFileStream);
            var (validatedRows, departmentPlans, groupPlans) = await ValidateAndResolveRowsAsync(rawRows);

            return new EmployeeImportPreviewResultDto
            {
                Rows = validatedRows,
                TotalRows = validatedRows.Count,
                ValidRows = validatedRows.Count(r => r.IsValid),
                InvalidRows = validatedRows.Count(r => !r.IsValid),
                NewDepartmentCount = departmentPlans.Values.Count(p => p.ExistingId == null),
                NewGroupCount = groupPlans.Values.Count(p => p.ExistingId == null)
            };
        }

        public async Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request)
        {
            // Validate lại từ đầu theo dữ liệu DB hiện tại (không tin Resolved*/IsNew* do client
            // gửi lên) — phòng trường hợp dữ liệu đã đổi kể từ lúc người dùng xem bản Preview.
            var (validatedRows, departmentPlans, groupPlans) = await ValidateAndResolveRowsAsync(request.Rows);

            var invalidRows = validatedRows.Where(x => !x.IsValid).ToList();
            var validRows = validatedRows.Where(x => x.IsValid).ToList();

            var result = new EmployeeImportConfirmResultDto
            {
                SkippedCount = invalidRows.Count,
                SkippedRows = invalidRows
                    .Select(r => new EmployeeImportSkippedRowDto { RowNumber = r.RowNumber, EmployeeCode = r.EmployeeCode, Errors = r.Errors })
                    .ToList()
            };

            if (validRows.Count == 0) return result;

            // Chỉ tạo Department/Group thực sự được dùng bởi ít nhất 1 dòng nhân viên HỢP LỆ —
            // tránh tạo rác nếu toàn bộ nhân viên dùng mã đó đều bị skip vì lỗi khác.
            var usedDepartmentCodes = validRows.Select(r => r.DepartmentCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var usedGroupCodes = validRows.Select(r => r.GroupCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // Department/Group mới được gán qua navigation property (chưa có Id thật) thay vì
                // Id trực tiếp — EF Core tự fix-up khóa ngoại đúng lúc SaveChangesAsync ở cuối,
                // giống cách OtFormService.CreateAsync gán OtFormEmployee.OtForm = newOtForm.
                var newDepartmentsByCode = new Dictionary<string, Department>(StringComparer.OrdinalIgnoreCase);
                foreach (var code in usedDepartmentCodes)
                {
                    var plan = departmentPlans[code];
                    if (plan.ExistingId.HasValue) continue;

                    var newDepartment = new Department
                    {
                        DepartmentCode = code,
                        DepartmentNameVn = plan.Name,
                        IsDeleted = false
                    };
                    await _unitOfWork.Departments.AddAsync(newDepartment);
                    newDepartmentsByCode[code] = newDepartment;
                    result.CreatedDepartmentCount++;
                }

                var newGroupsByCode = new Dictionary<string, Group>(StringComparer.OrdinalIgnoreCase);
                foreach (var code in usedGroupCodes)
                {
                    var plan = groupPlans[code];
                    if (plan.ExistingId.HasValue) continue;

                    var newGroup = new Group
                    {
                        GroupCode = code,
                        GroupNameVn = plan.Name,
                        IsDeleted = false
                    };

                    if (newDepartmentsByCode.TryGetValue(plan.DepartmentCode, out var newDepartmentEntity))
                        newGroup.Department = newDepartmentEntity;
                    else
                        newGroup.DepartmentId = departmentPlans[plan.DepartmentCode].ExistingId!.Value;

                    await _unitOfWork.Groups.AddAsync(newGroup);
                    newGroupsByCode[code] = newGroup;
                    result.CreatedGroupCount++;
                }

                // Nhân viên đã tồn tại (Code unique, khớp DB) được UPDATE tại chỗ thay vì tạo mới —
                // chỉ nạp đúng những Employee cần update (không load toàn bộ bảng).
                var employeeCodesToUpdate = validRows.Where(r => !r.IsNewEmployee).Select(r => r.EmployeeCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var employeesToUpdateByCode = employeeCodesToUpdate.Count == 0
                    ? new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase)
                    : (await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && employeeCodesToUpdate.Contains(x.Code)))
                        .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

                var now = DateTime.UtcNow;
                foreach (var row in validRows)
                {
                    int? resolvedGroupId = newGroupsByCode.TryGetValue(row.GroupCode!, out var newGroupEntity)
                        ? null
                        : groupPlans[row.GroupCode!].ExistingId!.Value;

                    if (row.IsNewEmployee)
                    {
                        var newEmployee = new Employee
                        {
                            Code = row.EmployeeCode!,
                            FirstName = row.ResolvedFirstName!,
                            LastName = row.ResolvedLastName!,
                            MonthToDate = 0,
                            YearToDate = 0,
                            AccumulationYear = now.Year,
                            AccumulationMonth = now.Month,
                            IsDeleted = false
                        };

                        if (newGroupEntity != null) newEmployee.Group = newGroupEntity;
                        else newEmployee.GroupId = resolvedGroupId!.Value;

                        await _unitOfWork.Employees.AddAsync(newEmployee);
                        result.CreatedEmployeeCount++;
                    }
                    else
                    {
                        // Chỉ cập nhật họ tên + nhóm — KHÔNG đụng MonthToDate/YearToDate/AccumulationYear/
                        // AccumulationMonth/UserName vì file Excel không có các cột này, re-import không
                        // được phép xóa mất lũy kế OT hay tài khoản AD đã gán cho nhân viên trước đó.
                        var existingEmployee = employeesToUpdateByCode[row.EmployeeCode!];
                        existingEmployee.FirstName = row.ResolvedFirstName!;
                        existingEmployee.LastName = row.ResolvedLastName!;

                        if (newGroupEntity != null) existingEmployee.Group = newGroupEntity;
                        else existingEmployee.GroupId = resolvedGroupId!.Value;

                        _unitOfWork.Employees.Update(existingEmployee);
                        result.UpdatedEmployeeCount++;
                    }
                }

                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }

            return result;
        }

        // Kết quả resolve 1 mã Department/Group: đã tồn tại (ExistingId có giá trị) hay sẽ tạo mới,
        // và có xung đột tên/phòng ban giữa các dòng trong file hay không (HasConflict).
        private sealed class DepartmentResolution
        {
            public int? ExistingId { get; set; }
            public string Name { get; set; } = null!;
            public bool HasConflict { get; set; }
        }

        private sealed class GroupResolution
        {
            public int? ExistingId { get; set; }
            public string Name { get; set; } = null!;
            public string DepartmentCode { get; set; } = null!;
            public bool HasConflict { get; set; }
        }

        private async Task<(List<EmployeeImportRowDto> Rows, Dictionary<string, DepartmentResolution> Departments, Dictionary<string, GroupResolution> Groups)>
            ValidateAndResolveRowsAsync(List<EmployeeImportRowDto> rawRows)
        {
            var existingDepartments = await _unitOfWork.Departments.SelectAsync(
                x => !x.IsDeleted, x => new { x.Id, x.DepartmentCode, x.DepartmentNameVn });
            var existingGroups = await _unitOfWork.Groups.SelectAsync(
                x => !x.IsDeleted, x => new { x.Id, x.GroupCode, x.GroupNameVn, DepartmentCode = x.Department.DepartmentCode });
            var existingEmployeeCodes = (await _unitOfWork.Employees.SelectAsync(x => !x.IsDeleted, x => x.Code))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var duplicatedEmployeeCodesInFile = FindDuplicates(rawRows, r => r.EmployeeCode);

            // Phase 1: gom định nghĩa Department/Group duy nhất theo mã trong file, phát hiện xung
            // đột (tên khác nhau cho cùng mã mới, hoặc mã Group đã thuộc Department khác trong DB).
            var departmentPlans = new Dictionary<string, DepartmentResolution>(StringComparer.OrdinalIgnoreCase);
            var groupPlans = new Dictionary<string, GroupResolution>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in rawRows)
            {
                var deptCode = row.DepartmentCode?.Trim();
                var deptName = row.DepartmentNameVn?.Trim();
                if (!string.IsNullOrWhiteSpace(deptCode) && !string.IsNullOrWhiteSpace(deptName))
                {
                    if (!departmentPlans.TryGetValue(deptCode, out var deptPlan))
                    {
                        var existing = existingDepartments.FirstOrDefault(d => string.Equals(d.DepartmentCode, deptCode, StringComparison.OrdinalIgnoreCase));
                        departmentPlans[deptCode] = new DepartmentResolution
                        {
                            ExistingId = existing?.Id,
                            Name = existing?.DepartmentNameVn ?? deptName
                        };
                    }
                    else if (deptPlan.ExistingId == null && !string.Equals(deptPlan.Name, deptName, StringComparison.OrdinalIgnoreCase))
                    {
                        deptPlan.HasConflict = true;
                    }
                }

                var groupCode = row.GroupCode?.Trim();
                var groupName = row.GroupNameVn?.Trim();
                if (!string.IsNullOrWhiteSpace(groupCode) && !string.IsNullOrWhiteSpace(groupName) && !string.IsNullOrWhiteSpace(deptCode))
                {
                    if (!groupPlans.TryGetValue(groupCode, out var groupPlan))
                    {
                        var existing = existingGroups.FirstOrDefault(g => string.Equals(g.GroupCode, groupCode, StringComparison.OrdinalIgnoreCase));
                        groupPlans[groupCode] = new GroupResolution
                        {
                            ExistingId = existing?.Id,
                            Name = existing?.GroupNameVn ?? groupName,
                            DepartmentCode = existing?.DepartmentCode ?? deptCode,
                            HasConflict = existing != null && !string.Equals(existing.DepartmentCode, deptCode, StringComparison.OrdinalIgnoreCase)
                        };
                    }
                    else
                    {
                        if (groupPlan.ExistingId == null && !string.Equals(groupPlan.Name, groupName, StringComparison.OrdinalIgnoreCase))
                            groupPlan.HasConflict = true;
                        if (!string.Equals(groupPlan.DepartmentCode, deptCode, StringComparison.OrdinalIgnoreCase))
                            groupPlan.HasConflict = true;
                    }
                }
            }

            // Phase 2: validate từng dòng nhân viên, tham chiếu lại các plan Department/Group ở trên.
            var result = new List<EmployeeImportRowDto>();
            foreach (var row in rawRows)
            {
                var errors = new List<string>();
                var employeeCode = row.EmployeeCode?.Trim();
                var fullName = row.FullName?.Trim();
                var deptCode = row.DepartmentCode?.Trim();
                var deptName = row.DepartmentNameVn?.Trim();
                var groupCode = row.GroupCode?.Trim();
                var groupName = row.GroupNameVn?.Trim();

                var isNewEmployee = false;
                if (string.IsNullOrWhiteSpace(employeeCode))
                {
                    errors.Add("Thiếu mã nhân viên.");
                }
                else
                {
                    // Trùng mã NGAY TRONG FILE vẫn là lỗi (không biết dòng nào đúng) — nhưng trùng
                    // với mã ĐÃ CÓ SẴN TRONG DB thì không còn là lỗi nữa, Confirm sẽ cập nhật lại
                    // thông tin nhân viên đó (upsert theo Code, xem EmployeeImportRowDto.IsNewEmployee).
                    if (duplicatedEmployeeCodesInFile.Contains(employeeCode))
                        errors.Add($"Mã nhân viên '{employeeCode}' bị lặp lại nhiều dòng trong file.");
                    isNewEmployee = !existingEmployeeCodes.Contains(employeeCode);
                }

                string? resolvedFirstName = null;
                string? resolvedLastName = null;
                if (string.IsNullOrWhiteSpace(fullName))
                {
                    errors.Add("Thiếu họ tên.");
                }
                else
                {
                    // Từ cuối cùng = tên riêng (FirstName), phần còn lại = họ + tên đệm (LastName) —
                    // khớp convention hiển thị "{LastName} {FirstName}" đang dùng ở OtFormService.
                    var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    resolvedFirstName = parts[^1];
                    resolvedLastName = parts.Length > 1 ? string.Join(' ', parts[..^1]) : string.Empty;
                }

                var isNewDepartment = false;
                if (string.IsNullOrWhiteSpace(deptCode) || string.IsNullOrWhiteSpace(deptName))
                {
                    errors.Add("Thiếu mã hoặc tên phòng ban.");
                }
                else if (departmentPlans.TryGetValue(deptCode, out var deptPlan))
                {
                    if (deptPlan.HasConflict)
                        errors.Add($"Phòng ban mã '{deptCode}' có tên không nhất quán giữa các dòng trong file.");
                    isNewDepartment = deptPlan.ExistingId == null;
                }

                var isNewGroup = false;
                if (string.IsNullOrWhiteSpace(groupCode) || string.IsNullOrWhiteSpace(groupName))
                {
                    errors.Add("Thiếu mã hoặc tên nhóm.");
                }
                else if (groupPlans.TryGetValue(groupCode, out var groupPlan))
                {
                    if (groupPlan.HasConflict)
                        errors.Add($"Nhóm mã '{groupCode}' có tên hoặc phòng ban không nhất quán giữa các dòng trong file, hoặc đã thuộc 1 phòng ban khác trong hệ thống.");
                    isNewGroup = groupPlan.ExistingId == null;
                }

                result.Add(new EmployeeImportRowDto
                {
                    RowNumber = row.RowNumber,
                    EmployeeCode = employeeCode,
                    FullName = fullName,
                    DepartmentCode = deptCode,
                    DepartmentNameVn = deptName,
                    GroupCode = groupCode,
                    GroupNameVn = groupName,
                    ResolvedFirstName = resolvedFirstName,
                    ResolvedLastName = resolvedLastName,
                    IsNewDepartment = isNewDepartment,
                    IsNewGroup = isNewGroup,
                    IsNewEmployee = isNewEmployee,
                    IsValid = errors.Count == 0,
                    Errors = errors
                });
            }

            return (result, departmentPlans, groupPlans);
        }

        private static HashSet<string> FindDuplicates(List<EmployeeImportRowDto> rows, Func<EmployeeImportRowDto, string?> selector)
        {
            return rows
                .Select(selector)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v!.Trim())
                .GroupBy(v => v, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        // Cột theo mẫu Excel nhân sự thật: A=No. (bỏ qua, không dùng), B=Employee code, C=Full name,
        // D=Department (mã), E=Department Name, F=Group (mã), G=Group Name.
        // Dòng header KHÔNG cố định ở dòng 1 — file thật có thể có tiêu đề/dòng trống phía trên
        // (2026-07-16, phát hiện khi test file thật: header nằm ở dòng 13) — nên tự dò dòng header
        // bằng cách tìm dòng có cột B = "Employee code" thay vì giả định luôn là dòng đầu tiên.
        private const string HeaderMarkerCellB = "Employee code";

        private static List<EmployeeImportRowDto> ParseXlsx(Stream stream)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                // Kèm loại + message của exception gốc vào Errors (trả về trong ApiResponse.errors) —
                // "File Excel không hợp lệ" là message chung chung, không đủ để tự chẩn đoán nguyên
                // nhân thật (VD file .xls cũ ClosedXML không đọc được, file bị mã hoá mật khẩu...).
                throw new DomainException(
                    "File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx).",
                    new List<string> { $"{ex.GetType().Name}: {ex.Message}" });
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var rows = new List<EmployeeImportRowDto>();
            if (usedRange == null) return rows;

            var allUsedRows = usedRange.RowsUsed().ToList();
            var headerRow = allUsedRows.FirstOrDefault(r =>
                string.Equals(r.Cell(2).GetString().Trim(), HeaderMarkerCellB, StringComparison.OrdinalIgnoreCase));

            if (headerRow == null)
                throw new DomainException($"Không tìm thấy dòng tiêu đề (cột B = \"{HeaderMarkerCellB}\") trong file — kiểm tra lại đúng mẫu file nhân sự.");

            foreach (var xlRow in allUsedRows.Where(r => r.RowNumber() > headerRow.RowNumber()))
            {
                var employeeCode = xlRow.Cell(2).GetString().Trim();
                var fullName = xlRow.Cell(3).GetString().Trim();
                var departmentCode = xlRow.Cell(4).GetString().Trim();
                var departmentName = xlRow.Cell(5).GetString().Trim();
                var groupCode = xlRow.Cell(6).GetString().Trim();
                var groupName = xlRow.Cell(7).GetString().Trim();

                var isRowEmpty = string.IsNullOrWhiteSpace(employeeCode) && string.IsNullOrWhiteSpace(fullName) &&
                    string.IsNullOrWhiteSpace(departmentCode) && string.IsNullOrWhiteSpace(departmentName) &&
                    string.IsNullOrWhiteSpace(groupCode) && string.IsNullOrWhiteSpace(groupName);
                if (isRowEmpty) continue;

                rows.Add(new EmployeeImportRowDto
                {
                    RowNumber = xlRow.RowNumber(),
                    EmployeeCode = string.IsNullOrWhiteSpace(employeeCode) ? null : employeeCode,
                    FullName = string.IsNullOrWhiteSpace(fullName) ? null : fullName,
                    DepartmentCode = string.IsNullOrWhiteSpace(departmentCode) ? null : departmentCode,
                    DepartmentNameVn = string.IsNullOrWhiteSpace(departmentName) ? null : departmentName,
                    GroupCode = string.IsNullOrWhiteSpace(groupCode) ? null : groupCode,
                    GroupNameVn = string.IsNullOrWhiteSpace(groupName) ? null : groupName
                });
            }

            return rows;
        }
    }
}
