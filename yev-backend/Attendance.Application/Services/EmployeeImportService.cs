using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.ProductionEmployeeImports;
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
        private readonly IDepartmentAccessGuard _departmentAccessGuard;

        public EmployeeImportService(IAttendanceUnitOfWork unitOfWork, IDepartmentAccessGuard departmentAccessGuard)
            : base(unitOfWork)
        {
            _departmentAccessGuard = departmentAccessGuard;
        }

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

            // worksheet.Cell(row, col) — KHÔNG dùng xlRow.Cell(col) (range-relative: nếu cột A trống
            // hoàn toàn, ClosedXML tự thu hẹp usedRange bắt đầu từ cột B, khiến Cell(2) trỏ nhầm sang
            // cột C) — đã tái hiện lỗi thật với chính file mẫu do GenerateTemplate() sinh ra (cột A cố
            // tình để trống theo quy ước), xem docs/docs-be/attendance-module.md (2026-09-03).
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

        // Mục 5 (2026-08-27, xem docs/Note_OT.txt "Import lại số giờ giới hạn tăng ca của nhân viên").
        // File Excel riêng, khác EmployeeImportRowDto ở trên: cột A bỏ trống (theo đúng quy ước các file
        // import khác trong module — vd Import_Nhan_Su_Che_Tao.xlsx), B=MNV, C=Giới hạn Tháng, D=Giới
        // hạn Năm. Chỉ UPDATE nhân viên ĐÃ TỒN TẠI (không tạo mới, không có Department/Group phụ thuộc
        // cần rà như import Employee đầy đủ) — không cần Preview/Confirm 2 bước, áp dụng thẳng và trả
        // lại kết quả từng dòng. Ô Giới hạn Tháng/Năm để TRỐNG ở 1 dòng = GIỮ NGUYÊN override cũ của
        // nhân viên đó (không phải xoá) — đã chốt với người dùng 2026-08-27.
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

            // worksheet.Cell(row, col) tuyệt đối — KHÔNG dùng r.Cell(col) range-relative, xem chú thích ở
            // ParseXlsx phía trên (2026-09-03).
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

            // Scope THEO TỪNG DÒNG (2026-08-29, mở rộng thêm Nhóm 2026-09-28) — file này nhận
            // EmployeeCode tự do, không hardcode 1 Phòng ban như ProductionEmployeeImportService. Admin
            // bỏ qua hoàn toàn; non-Admin phải là Coordinator đúng Phòng ban HOẶC đúng Nhóm thật của
            // nhân viên đó (trực tiếp qua DepartmentId, hoặc gián tiếp qua Group.DepartmentId —
            // FindAsync không include navigation nên tra riêng 1 lượt) — cùng scope với sửa-từng-người
            // (EnsureCanManageDeptOrGroupScopeAsync), xem docs/docs-be/attendance-module.md §Phân quyền
            // theo Phòng ban.
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

        // Import lũy kế OT theo THÁNG cho MỌI Phòng ban (2026-09-03, theo yêu cầu người dùng — nguồn dữ
        // liệu ban đầu là file HR ngoài "phép năm và tăng ca 062026- Công Vụ.xlsx", nhưng hệ thống dùng
        // FORMAT RIÊNG đơn giản hơn thay vì khớp cột file gốc: file gốc tách 7 loại giờ (đêm/CN/Lễ...)
        // phục vụ tính lương, còn EmployeeAccumulationHistory hiện chỉ lưu TỔNG giờ/tháng — chỉ lấy đúng
        // 2 cột cần thiết). Cùng logic delta-upsert + scope theo từng dòng với
        // ProductionEmployeeImportService.ApplyAccumulationAsync (unique index (EmployeeId,Year,Month)
        // trên EmployeeAccumulationHistories buộc phải cộng dồn CHÊNH LỆCH thay vì ghi đè — xem file đó
        // để biết đầy đủ lý do; không trích thành helper dùng chung vì 2 service không cùng 1 lớp cha
        // chứa logic, và đoạn này đủ ngắn để giữ độc lập, cùng tinh thần các ParseXlsx của module này).
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

            // worksheet.Cell(row, col) tuyệt đối — KHÔNG dùng r.Cell(col) range-relative, xem chú thích ở
            // ParseXlsx phía trên (2026-09-03).
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

            // Scope THEO TỪNG DÒNG (EmployeeCode tự do, không hardcode 1 Phòng ban), mở rộng thêm Nhóm
            // (2026-09-28) — cùng nguyên tắc ImportOtHourLimitsAsync/ApplyAccumulationAsync, xem
            // docs/docs-be/attendance-module.md §Phân quyền theo Phòng ban.
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

                // 1. Cập nhật lũy kế Tháng (nếu có giá trị cột C)
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

                // 2. Cập nhật lũy kế Năm độc lập (nếu có giá trị cột D) vào dòng số dư đầu kỳ (Month = 0)
                if (row.YearHours.HasValue)
                {
                    var targetYearHours = row.YearHours.Value;
                    // Lũy kế năm hiện tại sau khi đã tính cả điều chỉnh tháng ở trên
                    var employeeYearRows = ledgerRowsByEmployee.TryGetValue(employee.Id, out var yRows) ? yRows : new List<EmployeeAccumulationHistory>();
                    var currentYearHours = employeeYearRows.Sum(x => x.TotalHours);
                    var deltaYear = targetYearHours - currentYearHours;

                    if (deltaYear != 0)
                    {
                        // Lưu phần chênh lệch vào dòng số dư đầu kỳ (Month = 0) để không làm sai lệch số giờ thực tế của từng tháng 1..12
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

        // File mẫu cho import Nhân viên đầy đủ (2026-08-27, theo yêu cầu người dùng — cột khớp ĐÚNG
        // ParseXlsx ở trên: B=Employee code, C=Full name, D=Department code, E=Department name,
        // F=Group code, G=Group name; cột A bỏ trống theo đúng quy ước các file import khác trong
        // module). Kèm 1 dòng ví dụ để người dùng dễ hình dung, không phải dữ liệu thật.
        public (byte[] Content, string FileName) GenerateTemplate()
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Nhan vien");

            string[] headers = { "", "Employee code", "Full name", "Department code", "Department name", "Group code", "Group name" };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            sheet.Cell(2, 2).Value = "NV001";
            sheet.Cell(2, 3).Value = "Nguyễn Văn A";
            sheet.Cell(2, 4).Value = "CT";
            sheet.Cell(2, 5).Value = "Chế tạo";
            sheet.Cell(2, 6).Value = "CT-A";
            sheet.Cell(2, 7).Value = "Nhóm A";

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return (stream.ToArray(), "Mau_Import_NhanVien.xlsx");
        }

        // File mẫu cho import giới hạn OT tháng/năm (mục 5, 2026-08-27) — cột khớp ĐÚNG
        // ImportOtHourLimitsAsync ở trên: B=MNV, C=Giới hạn Tháng, D=Giới hạn Năm.
        public (byte[] Content, string FileName) GenerateOtHourLimitTemplate()
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Gioi han OT");

            string[] headers = { "", "MNV", "Giới hạn Tháng", "Giới hạn Năm" };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            sheet.Cell(2, 2).Value = "NV001";
            sheet.Cell(2, 3).Value = 25;
            sheet.Cell(2, 4).Value = 300;

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return (stream.ToArray(), "Mau_Import_GioiHanOT.xlsx");
        }

        // File mẫu cho import lũy kế OT theo tháng và năm (2026-09-04) — cột khớp ĐÚNG
        // ImportMonthlyAccumulationAsync ở trên: B=MNV, C=Tổng giờ OT tháng, D=Tổng giờ OT năm.
        // Năm/Tháng áp dụng chọn riêng ở màn import (không phải cột trong file).
        public (byte[] Content, string FileName) GenerateMonthlyAccumulationTemplate()
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Luy ke OT");

            string[] headers = { "", "MNV", "Tổng giờ OT tháng", "Tổng giờ OT năm" };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            sheet.Cell(2, 2).Value = "NV001";
            sheet.Cell(2, 3).Value = 16.25;
            sheet.Cell(2, 4).Value = 120.50;

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return (stream.ToArray(), "Mau_Import_LuyKeOT.xlsx");
        }
    }
}
