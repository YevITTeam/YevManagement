using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using ClosedXML.Excel;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Bulk import Employees (upsert by Code — Code is unique: if the code already exists, update
    // FirstName/LastName/GroupId; otherwise create new) with automatic creation of Department/Group
    // if the code doesn't exist yet (real HR data usually lists Department/Group directly on the
    // same row as the employee, with no separate file).
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
            // Re-validate from scratch against the current DB data (don't trust the Resolved*/IsNew*
            // fields sent by the client) — in case the data has changed since the user viewed the Preview.
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

            // Only create Department/Group entries that are actually used by at least 1 VALID
            // employee row — avoid creating orphan records if all employees using that code get
            // skipped due to other errors.
            var usedDepartmentCodes = validRows.Select(r => r.DepartmentCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var usedGroupCodes = validRows.Select(r => r.GroupCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // New Department/Group entities are assigned via navigation property (they don't have
                // a real Id yet) instead of a direct Id — EF Core automatically fixes up the foreign
                // key at SaveChangesAsync time, the same way OtFormService.CreateAsync assigns
                // OtFormEmployee.OtForm = newOtForm.
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

                // Employees that already exist (Code unique, matched in DB) are UPDATED in place
                // instead of being created anew — only load the Employees that actually need
                // updating (not the entire table).
                var employeeCodesToUpdate = validRows.Where(r => !r.IsNewEmployee).Select(r => r.EmployeeCode!).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var employeesToUpdateByCode = employeeCodesToUpdate.Count == 0
                    ? new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase)
                    : (await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && employeeCodesToUpdate.Contains(x.Code)))
                        .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

                var now = TimeHelper.GetCurrentUtcTime();
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
                        // Only update the name + group — DO NOT touch MonthToDate/YearToDate/AccumulationYear/
                        // AccumulationMonth/UserName since the Excel file has no such columns; re-importing
                        // must not wipe out OT accumulation or the AD account already assigned to the employee.
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

        // Result of resolving 1 Department/Group code: already exists (ExistingId has a value) or will
        // be created new, and whether there's a name/department conflict between rows in the file (HasConflict).
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

            // Phase 1: collect unique Department/Group definitions by code across the file, detect
            // conflicts (different names for the same new code, or a Group code that already belongs
            // to a different Department in the DB).
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

                var isNewEmployee = false;
                if (string.IsNullOrWhiteSpace(employeeCode))
                {
                    errors.Add("Thiếu mã nhân viên.");
                }
                else
                {
                    // A code duplicated WITHIN THE FILE is still an error (can't tell which row is
                    // correct) — but a code that ALREADY EXISTS IN THE DB is no longer an error;
                    // Confirm will update that employee's info instead (upsert by Code, see
                    // EmployeeImportRowDto.IsNewEmployee).
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
                    // Last word = given name (FirstName), the rest = family + middle name (LastName) —
                    // matches the "{LastName} {FirstName}" display convention used in OtFormService.
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

        // Columns per the real HR Excel template: A=No. (ignored, unused), B=Employee code, C=Full name,
        // D=Department (code), E=Department Name, F=Group (code), G=Group Name.
        // The header row is NOT fixed at row 1 — real files may have a title/blank rows above it
        // (2026-07-16, discovered while testing a real file: the header was on row 13) — so we detect
        // the header row by finding the row where column B = "Employee code" instead of assuming it's always the first row.
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
                // Include the underlying exception's type + message in Errors (returned in
                // ApiResponse.errors) — "Invalid Excel file" is too generic on its own to diagnose the
                // real cause (e.g. an old .xls file ClosedXML can't read, a password-protected file...).
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
