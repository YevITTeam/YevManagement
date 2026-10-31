using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.ProductionEmployeeImports;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Upserts employees by Code and auto-creates missing Department/Group, since HR files list them on the same row.
    public class EmployeeImportService : BaseService<IAttendanceUnitOfWork>, IEmployeeImportService
    {
        private readonly IDepartmentAccessGuard _departmentAccessGuard;
        private readonly IEmployeeService _employeeService;

        public EmployeeImportService(IAttendanceUnitOfWork unitOfWork, IDepartmentAccessGuard departmentAccessGuard,
            IEmployeeService employeeService)
            : base(unitOfWork)
        {
            _departmentAccessGuard = departmentAccessGuard;
            _employeeService = employeeService;
        }

        public async Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string userName, bool isAdmin)
        {
            var rawRows = ParseXlsx(excelFileStream);
            var (validatedRows, departmentPlans, groupPlans) = await ValidateAndResolveRowsAsync(rawRows, userName, isAdmin);

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

        public async Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request, string userName, bool isAdmin)
        {
            // Re-validate against current DB data; never trust client-sent Resolved*/IsNew* fields.
            var (validatedRows, departmentPlans, groupPlans) = await ValidateAndResolveRowsAsync(request.Rows, userName, isAdmin);

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

            // Create only codes used by at least one valid row, to avoid orphan Department/Group records.
            var usedDepartmentCodes = validRows.Select(r => r.DepartmentCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var usedGroupCodes = validRows.Select(r => r.GroupCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // New entities have no Id yet, so link via navigation and let EF fix up FKs on save.
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

                // The Excel has no workshop column, so new groups land in the default (first) workshop.
                var defaultWorkshop = usedGroupCodes.Any(c => !groupPlans[c].ExistingId.HasValue)
                    ? (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => !x.IsDeleted)).OrThrowNotFound("Xưởng", "mặc định")
                    : null;
                var newGroupsByCode = new Dictionary<string, Group>(StringComparer.OrdinalIgnoreCase);
                foreach (var code in usedGroupCodes)
                {
                    var plan = groupPlans[code];
                    if (plan.ExistingId.HasValue) continue;

                    var newGroup = new Group
                    {
                        GroupCode = code,
                        GroupNameVn = plan.Name,
                        WorkshopId = defaultWorkshop!.Id,
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

                // Load only employees that need updating, not the whole table.
                var employeeCodesToUpdate = validRows.Where(r => !r.IsNewEmployee).Select(r => r.EmployeeCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var employeesToUpdateByCode = employeeCodesToUpdate.Count == 0
                    ? new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase)
                    : (await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && employeeCodesToUpdate.Contains(x.Code)))
                        .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

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
                            IsDeleted = false
                        };

                        if (newGroupEntity != null) newEmployee.Group = newGroupEntity;
                        else newEmployee.GroupId = resolvedGroupId!.Value;

                        await _unitOfWork.Employees.AddAsync(newEmployee);
                        result.CreatedEmployeeCount++;
                    }
                    else
                    {
                        // Name and group only: the file has no accumulation/UserName columns, so re-import must not wipe them.
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

        private sealed class DepartmentResolution
        {
            public int? ExistingId { get; set; }
            public string Name { get; set; } = null!;
            public bool HasConflict { get; set; }
        }

        private sealed class GroupResolution
        {
            public int? ExistingId { get; set; }
            public int? ExistingDepartmentId { get; set; }
            public string Name { get; set; } = null!;
            public string DepartmentCode { get; set; } = null!;
            public bool HasConflict { get; set; }
        }

        private async Task<(List<EmployeeImportRowDto> Rows, Dictionary<string, DepartmentResolution> Departments, Dictionary<string, GroupResolution> Groups)>
            ValidateAndResolveRowsAsync(List<EmployeeImportRowDto> rawRows, string userName, bool isAdmin)
        {
            var existingDepartments = await _unitOfWork.Departments.SelectAsync(
                x => !x.IsDeleted, x => new { x.Id, x.DepartmentCode, x.DepartmentNameVn });
            var existingGroups = await _unitOfWork.Groups.SelectAsync(
                x => !x.IsDeleted, x => new { x.Id, x.GroupCode, x.GroupNameVn, x.DepartmentId, DepartmentCode = x.Department.DepartmentCode });
            var codesInFile = rawRows.Where(r => !string.IsNullOrWhiteSpace(r.EmployeeCode))
                .Select(r => r.EmployeeCode!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var existingEmployees = (await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && codesInFile.Contains(x.Code),
                x => new
                {
                    x.Code,
                    x.GroupId,
                    DepartmentId = x.DepartmentId ?? (x.Group != null ? (int?)x.Group.DepartmentId : null),
                    TerminalLevel = x.JobTitle != null ? x.JobTitle.TerminalLevel : (int)JobTitleTerminalLevel.None
                }))
                .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

            // Non-admins (coordinators) may only touch employees and groups inside the units they manage.
            var managedDepartmentIds = isAdmin ? null : await _departmentAccessGuard.GetManagedDepartmentIdsAsync(userName);
            var managedGroupIds = isAdmin ? null : (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.Employee.UserName == userName && !x.IsDeleted)).Select(x => x.GroupId).ToHashSet();
            bool InCallerScope(int? departmentId, int? groupId) => isAdmin
                || (departmentId.HasValue && managedDepartmentIds!.Contains(departmentId.Value))
                || (groupId.HasValue && managedGroupIds!.Contains(groupId.Value));

            var duplicatedEmployeeCodesInFile = FindDuplicates(rawRows, r => r.EmployeeCode);

            // Phase 1: collect Department/Group codes and detect conflicts (same new code with different names,
            // or a Group code already under another Department).
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
                            ExistingDepartmentId = existing?.DepartmentId,
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

            // Phase 2: validate each employee row, referencing the Department/Group plans built above.
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
                var existingEmployee = string.IsNullOrWhiteSpace(employeeCode) ? null : existingEmployees.GetValueOrDefault(employeeCode);

                var isNewEmployee = false;
                if (string.IsNullOrWhiteSpace(employeeCode))
                {
                    errors.Add("Thiếu mã nhân viên.");
                }
                else
                {
                    // Duplicates within the file are errors; codes already in the DB are updated on Confirm.
                    if (duplicatedEmployeeCodesInFile.Contains(employeeCode))
                        errors.Add($"Mã nhân viên '{employeeCode}' bị lặp lại nhiều dòng trong file.");
                    isNewEmployee = existingEmployee == null;
                }

                string? resolvedFirstName = null;
                string? resolvedLastName = null;
                if (string.IsNullOrWhiteSpace(fullName))
                {
                    errors.Add("Thiếu họ tên.");
                }
                else
                {
                    // Last word = FirstName, rest = LastName, matching the "{LastName} {FirstName}" display convention.
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
                    if (!isNewGroup && !InCallerScope(groupPlan.ExistingDepartmentId, groupPlan.ExistingId))
                        errors.Add($"Nhóm '{groupCode}' không thuộc phạm vi bạn phụ trách.");
                }

                if (!isAdmin && isNewDepartment)
                    errors.Add($"Chỉ Admin được tạo Bộ phận mới '{deptCode}'.");
                if (!isAdmin && isNewGroup)
                    errors.Add($"Chỉ Admin được tạo Nhóm mới '{groupCode}'.");
                if (existingEmployee != null && !InCallerScope(existingEmployee.DepartmentId, existingEmployee.GroupId))
                    errors.Add($"Nhân viên '{employeeCode}' đang thuộc đơn vị ngoài phạm vi bạn phụ trách.");
                // Import would put a manager into a Group, breaking the job-title organisation rules.
                if (existingEmployee != null && existingEmployee.TerminalLevel != (int)JobTitleTerminalLevel.None)
                    errors.Add("Nhân viên giữ chức vụ Trưởng phòng trở lên — sửa ở màn Nhân viên, không qua import.");

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

        // A=No. (ignored), B=Employee code, C=Full name, D/E=Department code/name, F/G=Group code/name.
        // The header row is located by column B since real files have title rows above it.
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
                // Include the inner exception so causes like old .xls or password-protected files are diagnosable.
                throw new DomainException(
                    "File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx).",
                    new List<string> { $"{ex.GetType().Name}: {ex.Message}" });
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var rows = new List<EmployeeImportRowDto>();
            if (usedRange == null) return rows;

            // Use absolute worksheet.Cell(row, col): range-relative xlRow.Cell(col) shifts when column A is empty.
            var allUsedRows = usedRange.RowsUsed().ToList();
            var headerRow = allUsedRows.FirstOrDefault(r =>
                string.Equals(worksheet.Cell(r.RowNumber(), 2).GetString().Trim(), HeaderMarkerCellB, StringComparison.OrdinalIgnoreCase));

            if (headerRow == null)
                throw new DomainException($"Không tìm thấy dòng tiêu đề (cột B = \"{HeaderMarkerCellB}\") trong file — kiểm tra lại đúng mẫu file nhân sự.");

            foreach (var xlRow in allUsedRows.Where(r => r.RowNumber() > headerRow.RowNumber()))
            {
                var employeeCode = worksheet.Cell(xlRow.RowNumber(), 2).GetString().Trim();
                var fullName = worksheet.Cell(xlRow.RowNumber(), 3).GetString().Trim();
                var departmentCode = worksheet.Cell(xlRow.RowNumber(), 4).GetString().Trim();
                var departmentName = worksheet.Cell(xlRow.RowNumber(), 5).GetString().Trim();
                var groupCode = worksheet.Cell(xlRow.RowNumber(), 6).GetString().Trim();
                var groupName = worksheet.Cell(xlRow.RowNumber(), 7).GetString().Trim();

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

        // B=MNV, C=monthly limit, D=yearly limit; updates existing employees only, applied directly without Preview.
        // An empty limit cell keeps the existing override (it does not clear it).
        private const string OtHourLimitHeaderMarkerCellB = "MNV";

        public async Task<EmployeeOtHourLimitImportResultDto> ImportOtHourLimitsAsync(Stream excelFileStream, string userName, bool isAdmin)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(excelFileStream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                throw new DomainException(
                    "File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx).",
                    new List<string> { $"{ex.GetType().Name}: {ex.Message}" });
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var result = new EmployeeOtHourLimitImportResultDto();
            if (usedRange == null) return result;

            // Absolute Cell(row, col); see ParseXlsx above.
            var allUsedRows = usedRange.RowsUsed().ToList();
            var headerRow = allUsedRows.FirstOrDefault(r =>
                string.Equals(worksheet.Cell(r.RowNumber(), 2).GetString().Trim(), OtHourLimitHeaderMarkerCellB, StringComparison.OrdinalIgnoreCase));
            if (headerRow == null)
                throw new DomainException(
                    $"Không tìm thấy dòng tiêu đề (cột B = \"{OtHourLimitHeaderMarkerCellB}\") trong file — đúng mẫu là cột B=MNV, C=Giới hạn Tháng, D=Giới hạn Năm.");

            var dataRows = allUsedRows
                .Where(r => r.RowNumber() > headerRow.RowNumber())
                .Select(r => new
                {
                    RowNumber = r.RowNumber(),
                    EmployeeCode = worksheet.Cell(r.RowNumber(), 2).GetString().Trim(),
                    MonthlyLimit = worksheet.Cell(r.RowNumber(), 3).TryGetValue<decimal>(out var m) ? (decimal?)m : null,
                    YearlyLimit = worksheet.Cell(r.RowNumber(), 4).TryGetValue<decimal>(out var y) ? (decimal?)y : null
                })
                .Where(r => !string.IsNullOrWhiteSpace(r.EmployeeCode))
                .ToList();

            var codes = dataRows.Select(r => r.EmployeeCode).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var employeesByCode = (await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && codes.Contains(x.Code)))
                .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

            // Scoped per row since codes are free-form: non-Admins must coordinate the employee's department or group.
            // FindAsync doesn't include navigation, so Group.DepartmentId is looked up separately.
            var managedDepartmentIds = isAdmin ? null : await _departmentAccessGuard.GetManagedDepartmentIdsAsync(userName);
            var managedGroupIds = isAdmin ? null : (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.Employee.UserName == userName && !x.IsDeleted)).Select(x => x.GroupId).ToHashSet();
            var groupIdsNeeded = employeesByCode.Values
                .Where(x => x.DepartmentId == null && x.GroupId.HasValue)
                .Select(x => x.GroupId!.Value)
                .ToHashSet();
            var departmentIdByGroupId = groupIdsNeeded.Count == 0
                ? new Dictionary<int, int>()
                : (await _unitOfWork.Groups.SelectAsync(x => groupIdsNeeded.Contains(x.Id), x => new { x.Id, x.DepartmentId }))
                    .ToDictionary(x => x.Id, x => x.DepartmentId);

            foreach (var row in dataRows)
            {
                if (!employeesByCode.TryGetValue(row.EmployeeCode, out var employee))
                {
                    result.SkippedCount++;
                    result.Rows.Add(new EmployeeOtHourLimitImportRowResultDto
                    {
                        RowNumber = row.RowNumber,
                        EmployeeCode = row.EmployeeCode,
                        Success = false,
                        Error = "Không tìm thấy nhân viên có mã này trong hệ thống."
                    });
                    continue;
                }

                if (managedDepartmentIds != null)
                {
                    int? resolvedDepartmentId = employee.DepartmentId;
                    if (resolvedDepartmentId == null && employee.GroupId.HasValue
                        && departmentIdByGroupId.TryGetValue(employee.GroupId.Value, out var deptFromGroup))
                    {
                        resolvedDepartmentId = deptFromGroup;
                    }

                    var inDepartmentScope = resolvedDepartmentId.HasValue && managedDepartmentIds.Contains(resolvedDepartmentId.Value);
                    var inGroupScope = employee.GroupId.HasValue && managedGroupIds!.Contains(employee.GroupId.Value);
                    if (!inDepartmentScope && !inGroupScope)
                    {
                        result.SkippedCount++;
                        result.Rows.Add(new EmployeeOtHourLimitImportRowResultDto
                        {
                            RowNumber = row.RowNumber,
                            EmployeeCode = row.EmployeeCode,
                            Success = false,
                            Error = "Nhân viên không thuộc Phòng ban/Nhóm bạn phụ trách."
                        });
                        continue;
                    }
                }

                if (row.MonthlyLimit.HasValue) employee.CustomMonthlyOtHourLimit = row.MonthlyLimit;
                if (row.YearlyLimit.HasValue) employee.CustomYearlyOtHourLimit = row.YearlyLimit;
                _unitOfWork.Employees.Update(employee);

                result.UpdatedCount++;
                result.Rows.Add(new EmployeeOtHourLimitImportRowResultDto
                {
                    RowNumber = row.RowNumber,
                    EmployeeCode = row.EmployeeCode,
                    Success = true,
                    MonthlyLimit = employee.CustomMonthlyOtHourLimit,
                    YearlyLimit = employee.CustomYearlyOtHourLimit
                });
            }

            await _unitOfWork.SaveChangesAsync();
            return result;
        }

        // Simplified 2-column format (code + monthly total) since the ledger stores only totals per month.
        // Delta-upsert because of the unique (EmployeeId, Year, Month) index; same logic as ApplyAccumulationAsync.
        private const string MonthlyAccumulationHeaderMarkerCellB = "MNV";

        public async Task<ProductionEmployeeAccumulationResultDto> ImportMonthlyAccumulationAsync(
            Stream excelFileStream, int year, int month, string userName, bool isAdmin)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(excelFileStream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                throw new DomainException(
                    "File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx).",
                    new List<string> { $"{ex.GetType().Name}: {ex.Message}" });
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var result = new ProductionEmployeeAccumulationResultDto();
            if (usedRange == null) return result;

            // Absolute Cell(row, col); see ParseXlsx above.
            var allUsedRows = usedRange.RowsUsed().ToList();
            var headerRow = allUsedRows.FirstOrDefault(r =>
                string.Equals(worksheet.Cell(r.RowNumber(), 2).GetString().Trim(), MonthlyAccumulationHeaderMarkerCellB, StringComparison.OrdinalIgnoreCase));
            if (headerRow == null)
                throw new DomainException(
                    $"Không tìm thấy dòng tiêu đề (cột B = \"{MonthlyAccumulationHeaderMarkerCellB}\") trong file — đúng mẫu là cột B=MNV, C=Tổng giờ OT tháng, D=Tổng giờ OT năm (tuỳ chọn).");

            var dataRows = allUsedRows
                .Where(r => r.RowNumber() > headerRow.RowNumber())
                .Select(r => new
                {
                    RowNumber = r.RowNumber(),
                    EmployeeCode = worksheet.Cell(r.RowNumber(), 2).GetString().Trim(),
                    TotalHours = worksheet.Cell(r.RowNumber(), 3).TryGetValue<decimal>(out var h) ? (decimal?)h : null,
                    YearHours = worksheet.Cell(r.RowNumber(), 4).TryGetValue<decimal>(out var y) ? (decimal?)y : null
                })
                .Where(r => !string.IsNullOrWhiteSpace(r.EmployeeCode) && (r.TotalHours.HasValue || r.YearHours.HasValue))
                .ToList();

            if (dataRows.Count == 0) return result;

            var codes = dataRows.Select(r => r.EmployeeCode).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var employeesByCode = (await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && codes.Contains(x.Code),
                x => new { x.Id, x.Code, x.GroupId, DepartmentId = x.DepartmentId ?? (x.Group != null ? (int?)x.Group.DepartmentId : null) }))
                .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

            // Scoped per row, same rules as ImportOtHourLimitsAsync.
            var managedDepartmentIds = isAdmin ? null : await _departmentAccessGuard.GetManagedDepartmentIdsAsync(userName);
            var managedGroupIds = isAdmin ? null : (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.Employee.UserName == userName && !x.IsDeleted)).Select(x => x.GroupId).ToHashSet();

            var employeeIds = employeesByCode.Values.Select(x => x.Id).ToList();
            var existingLedgerRows = employeeIds.Count == 0
                ? new List<EmployeeAccumulationHistory>()
                : (await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                    x => employeeIds.Contains(x.EmployeeId) && x.Year == year));

            var ledgerRowsByEmployeeAndMonth = existingLedgerRows
                .GroupBy(x => (x.EmployeeId, x.Month))
                .ToDictionary(g => g.Key, g => g.First());

            var ledgerRowsByEmployee = existingLedgerRows
                .GroupBy(x => x.EmployeeId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var note = $"Điều chỉnh từ import lũy kế OT theo tháng/năm ngày {TimeHelper.GetCurrentUtcTime():dd/MM/yyyy HH:mm}";

            foreach (var row in dataRows)
            {
                if (!employeesByCode.TryGetValue(row.EmployeeCode, out var employee))
                {
                    result.SkippedCount++;
                    result.SkippedRows.Add(new ProductionEmployeeAccumulationSkippedRowDto
                    {
                        EmployeeCode = row.EmployeeCode,
                        Reason = "Không tìm thấy nhân viên trong hệ thống."
                    });
                    continue;
                }

                if (managedDepartmentIds != null)
                {
                    var inDepartmentScope = employee.DepartmentId.HasValue && managedDepartmentIds.Contains(employee.DepartmentId.Value);
                    var inGroupScope = employee.GroupId.HasValue && managedGroupIds!.Contains(employee.GroupId.Value);
                    if (!inDepartmentScope && !inGroupScope)
                    {
                        result.SkippedCount++;
                        result.SkippedRows.Add(new ProductionEmployeeAccumulationSkippedRowDto
                        {
                            EmployeeCode = row.EmployeeCode,
                            Reason = "Nhân viên không thuộc Phòng ban/Nhóm bạn phụ trách."
                        });
                        continue;
                    }
                }

                var changedMonth = false;
                var changedYear = false;

                // Monthly accumulation (column C).
                if (row.TotalHours.HasValue)
                {
                    var targetMonthHours = row.TotalHours.Value;
                    var hasMonthRow = ledgerRowsByEmployeeAndMonth.TryGetValue((employee.Id, month), out var monthRow);
                    var currentMonthHours = hasMonthRow ? monthRow!.TotalHours : 0m;
                    var deltaMonth = targetMonthHours - currentMonthHours;

                    if (deltaMonth != 0)
                    {
                        if (hasMonthRow)
                        {
                            monthRow!.TotalHours += deltaMonth;
                            monthRow.Note = string.IsNullOrEmpty(monthRow.Note) ? note : monthRow.Note + "; " + note;
                            _unitOfWork.EmployeeAccumulationHistories.Update(monthRow);
                        }
                        else
                        {
                            var newMonthRow = new EmployeeAccumulationHistory
                            {
                                EmployeeId = employee.Id,
                                Year = year,
                                Month = month,
                                TotalHours = deltaMonth,
                                Note = note
                            };
                            await _unitOfWork.EmployeeAccumulationHistories.AddAsync(newMonthRow);
                            ledgerRowsByEmployeeAndMonth[(employee.Id, month)] = newMonthRow;
                            if (!ledgerRowsByEmployee.TryGetValue(employee.Id, out var list))
                            {
                                list = new List<EmployeeAccumulationHistory>();
                                ledgerRowsByEmployee[employee.Id] = list;
                            }
                            list.Add(newMonthRow);
                        }

                        result.AdjustedCount++;
                        result.TotalDeltaHours += deltaMonth;
                        changedMonth = true;
                    }
                }

                // Yearly accumulation (column D) goes to the opening-balance row (Month = 0).
                if (row.YearHours.HasValue)
                {
                    var targetYearHours = row.YearHours.Value;
                    // Current year total including the monthly adjustment above.
                    var employeeYearRows = ledgerRowsByEmployee.TryGetValue(employee.Id, out var yRows) ? yRows : new List<EmployeeAccumulationHistory>();
                    var currentYearHours = employeeYearRows.Sum(x => x.TotalHours);
                    var deltaYear = targetYearHours - currentYearHours;

                    if (deltaYear != 0)
                    {
                        // Store the delta on Month = 0 so actual hours for months 1..12 stay accurate.
                        var hasInitialRow = ledgerRowsByEmployeeAndMonth.TryGetValue((employee.Id, 0), out var initialRow);
                        if (hasInitialRow)
                        {
                            initialRow!.TotalHours += deltaYear;
                            initialRow.Note = string.IsNullOrEmpty(initialRow.Note) ? note : initialRow.Note + "; " + note;
                            _unitOfWork.EmployeeAccumulationHistories.Update(initialRow);
                        }
                        else
                        {
                            var newInitialRow = new EmployeeAccumulationHistory
                            {
                                EmployeeId = employee.Id,
                                Year = year,
                                Month = 0,
                                TotalHours = deltaYear,
                                Note = $"Số dư lũy kế đầu kỳ/các tháng trước từ import ngày {TimeHelper.GetCurrentUtcTime():dd/MM/yyyy HH:mm}"
                            };
                            await _unitOfWork.EmployeeAccumulationHistories.AddAsync(newInitialRow);
                            ledgerRowsByEmployeeAndMonth[(employee.Id, 0)] = newInitialRow;
                            if (!ledgerRowsByEmployee.TryGetValue(employee.Id, out var list))
                            {
                                list = new List<EmployeeAccumulationHistory>();
                                ledgerRowsByEmployee[employee.Id] = list;
                            }
                            list.Add(newInitialRow);
                        }

                        result.AdjustedYearCount++;
                        result.TotalDeltaYearHours += deltaYear;
                        changedYear = true;
                    }
                }

                if (!changedMonth && !changedYear)
                {
                    result.UnchangedCount++;
                }
            }

            await _unitOfWork.SaveChangesAsync();
            return result;
        }

        private static readonly string[] EmployeeNotes =
        {
            "Mỗi dòng 1 nhân viên. Mã NV đã có → cập nhật họ tên, Nhóm; chưa có → tạo mới.",
            "Bộ phận/Nhóm chưa có trong hệ thống sẽ được tạo mới (chỉ Admin). Người phụ trách chỉ import được vào đơn vị mình phụ trách.",
            "Nhân viên giữ chức vụ Trưởng phòng trở lên không import được — sửa ở màn Nhân viên.",
            "Tài khoản đăng nhập, email nhận thông báo, Chức vụ, chữ ký: dùng import Liên kết tài khoản.",
        };

        private static readonly ImportTemplateColumn[] EmployeeColumns =
        {
            new("Employee code", 16, true, "@"),
            new("Full name", 28, true),
            new("Department code", 16, true),
            new("Department name", 26, true),
            new("Group code", 14, true),
            new("Group name", 26, true),
        };

        private async Task<ImportTemplateColumn[]> EmployeeColumnsWithOptionsAsync()
        {
            var departments = await _unitOfWork.Departments.SelectAsync(x => !x.IsDeleted,
                x => new ImportTemplateOption(x.DepartmentCode, x.DepartmentNameVn));
            var groups = await _unitOfWork.Groups.SelectAsync(x => !x.IsDeleted,
                x => new ImportTemplateOption(x.GroupCode, x.GroupNameVn));
            var columns = EmployeeColumns.ToArray();
            columns[2] = columns[2] with { Options = departments.OrderBy(x => x.Value).ToList(), AllowOtherValues = true };
            columns[4] = columns[4] with { Options = groups.OrderBy(x => x.Value).ToList(), AllowOtherValues = true };
            return columns;
        }

        private static readonly string[] OtHourLimitNotes =
        {
            "Mỗi dòng 1 nhân viên đã có trong hệ thống. Áp dụng ngay khi import, không có bước xem trước.",
            "Ô để trống = giữ nguyên giới hạn hiện tại của nhân viên đó. Ví dụ: NV001 | 30 | 320.",
        };

        private static readonly ImportTemplateColumn[] OtHourLimitColumns =
        {
            new("MNV", 16, true, "@"),
            new("Giới hạn tháng (giờ)", 20, false, "0.##"),
            new("Giới hạn năm (giờ)", 20, false, "0.##"),
        };

        private static readonly string[] MonthlyAccumulationNotes =
        {
            "Chọn Năm/Tháng áp dụng trên màn import. Áp dụng ngay, không có bước xem trước; chạy lại cùng file không cộng trùng.",
            "Tổng giờ OT tháng: tổng giờ của tháng đã chọn. Tổng giờ OT năm (tuỳ chọn): tổng giờ từ đầu năm tới hết tháng đã chọn.",
            "Ví dụ: NV001 | 16.25 | 120.5.",
        };

        private static readonly ImportTemplateColumn[] MonthlyAccumulationColumns =
        {
            new("MNV", 16, true, "@"),
            new("Tổng giờ OT tháng", 20, true, "0.00"),
            new("Tổng giờ OT năm", 20, false, "0.00"),
        };

        private static string ExportStamp() => TimeHelper.GetCurrentUtcTime().AddHours(7).ToString("yyyyMMdd_HHmm");

        public async Task<(byte[] Content, string FileName)> GenerateTemplateAsync() => ImportTemplateBuilder.Build(
            "Nhan vien", "MẪU IMPORT NHÂN SỰ", EmployeeNotes, await EmployeeColumnsWithOptionsAsync(),
            new[] { new object?[] { "NV001", "Nguyễn Văn A", "CT", "Chế tạo", "CT-A", "Nhóm A" } },
            "Mau_Import_NhanVien.xlsx");

        public (byte[] Content, string FileName) GenerateOtHourLimitTemplate() => ImportTemplateBuilder.Build(
            "Gioi han OT", "MẪU IMPORT GIỚI HẠN GIỜ TĂNG CA RIÊNG", OtHourLimitNotes, OtHourLimitColumns,
            Array.Empty<object?[]>(), "Mau_Import_GioiHanOT.xlsx");

        public (byte[] Content, string FileName) GenerateMonthlyAccumulationTemplate() => ImportTemplateBuilder.Build(
            "Luy ke OT", "MẪU IMPORT LŨY KẾ GIỜ TĂNG CA", MonthlyAccumulationNotes, MonthlyAccumulationColumns,
            Array.Empty<object?[]>(), "Mau_Import_LuyKeOT.xlsx");

        public async Task<(byte[] Content, string FileName)> ExportEmployeesAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin)
        {
            // Managers and above have no Group and are rejected by this import, so they are not exported.
            var rows = (await _employeeService.GetForExportAsync(userName, isAdmin, filter))
                .Where(x => x.GroupCode != null && x.TerminalLevel == (int)JobTitleTerminalLevel.None)
                .Select(x => new object?[] { x.Code, x.FullName, x.DepartmentCode, x.DepartmentNameVn, x.GroupCode, x.GroupNameVn })
                .ToList();
            return ImportTemplateBuilder.Build("Nhan vien", "IMPORT NHÂN SỰ", EmployeeNotes, await EmployeeColumnsWithOptionsAsync(), rows,
                $"NhanVien_{ExportStamp()}.xlsx", rowsAreSamples: false);
        }

        public async Task<(byte[] Content, string FileName)> ExportOtHourLimitsAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin)
        {
            var rows = (await _employeeService.GetForExportAsync(userName, isAdmin, filter))
                .Select(x => new object?[] { x.Code, x.CustomMonthlyOtHourLimit, x.CustomYearlyOtHourLimit })
                .ToList();
            return ImportTemplateBuilder.Build("Gioi han OT", "IMPORT GIỚI HẠN GIỜ TĂNG CA RIÊNG", OtHourLimitNotes, OtHourLimitColumns, rows,
                $"GioiHanOT_{ExportStamp()}.xlsx", rowsAreSamples: false);
        }

        public async Task<(byte[] Content, string FileName)> ExportMonthlyAccumulationAsync(
            EmployeeExportFilterDto filter, int year, int month, string userName, bool isAdmin)
        {
            var rows = (await _employeeService.GetForExportAsync(userName, isAdmin, filter, year, month))
                .Select(x => new object?[] { x.Code, x.MonthHours, x.YearHours })
                .ToList();
            return ImportTemplateBuilder.Build("Luy ke OT", $"IMPORT LŨY KẾ GIỜ TĂNG CA — THÁNG {month:00}/{year}", MonthlyAccumulationNotes,
                MonthlyAccumulationColumns, rows, $"LuyKeOT_{year}{month:00}_{ExportStamp()}.xlsx", rowsAreSamples: false);
        }
    }
}
