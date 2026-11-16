using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.ProductionEmployeeImports;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Constants;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // One file for every employee: upserts by Code, auto-creates missing Department/Group, and carries the production roster.
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

        public async Task<EmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream, EmployeeImportMode mode, string userName, bool isAdmin)
        {
            var rawRows = ParseXlsx(excelFileStream);
            var (validatedRows, departmentPlans, groupPlans, removedRows) = await ValidateAndResolveRowsAsync(rawRows, mode, userName, isAdmin);

            return new EmployeeImportPreviewResultDto
            {
                Rows = validatedRows,
                TotalRows = validatedRows.Count,
                ValidRows = validatedRows.Count(r => r.IsValid),
                InvalidRows = validatedRows.Count(r => !r.IsValid),
                NewDepartmentCount = validatedRows.Where(r => r.IsValid && r.IsNewDepartment).Select(r => r.DepartmentCode).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                NewGroupCount = validatedRows.Where(r => r.IsValid && r.IsNewGroup).Select(r => r.GroupCode).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                RemovedRows = removedRows
            };
        }

        public async Task<EmployeeImportConfirmResultDto> ConfirmAsync(ConfirmEmployeeImportDto request, string userName, bool isAdmin)
        {
            // Re-validate against current DB data; never trust client-sent Resolved*/IsNew* fields.
            var (validatedRows, departmentPlans, groupPlans, removedRows) = await ValidateAndResolveRowsAsync(request.Rows, request.Mode, userName, isAdmin);

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

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // Only groups used by a valid row are created, and a new department only exists to hold a new group.
                var newGroupPlans = validRows.Where(r => r.IsNewGroup).Select(r => groupPlans[r.GroupCode!]).Distinct().ToList();

                // New entities have no Id yet, so link via navigation and let EF fix up FKs on save.
                var newDepartmentsByCode = new Dictionary<string, Department>(StringComparer.OrdinalIgnoreCase);
                foreach (var code in newGroupPlans.Select(p => p.DepartmentCode).Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    var plan = departmentPlans[code];
                    if (plan.ExistingId.HasValue) continue;

                    var newDepartment = new Department { DepartmentCode = code, DepartmentNameVn = plan.Name, IsDeleted = false };
                    await _unitOfWork.Departments.AddAsync(newDepartment);
                    newDepartmentsByCode[code] = newDepartment;
                    result.CreatedDepartmentCount++;
                }

                var newGroupsByCode = new Dictionary<string, Group>(StringComparer.OrdinalIgnoreCase);
                foreach (var plan in newGroupPlans)
                {
                    var newGroup = new Group { GroupCode = plan.Code, GroupNameVn = plan.Name, WorkshopId = plan.NewWorkshopId!.Value, IsDeleted = false };
                    if (newDepartmentsByCode.TryGetValue(plan.DepartmentCode, out var newDepartmentEntity))
                        newGroup.Department = newDepartmentEntity;
                    else
                        newGroup.DepartmentId = departmentPlans[plan.DepartmentCode].ExistingId!.Value;

                    await _unitOfWork.Groups.AddAsync(newGroup);
                    newGroupsByCode[plan.Code] = newGroup;
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
                    var employee = row.IsNewEmployee
                        ? new Employee { Code = row.EmployeeCode!, FirstName = row.ResolvedFirstName!, LastName = row.ResolvedLastName!, IsDeleted = false }
                        : employeesToUpdateByCode[row.EmployeeCode!];
                    employee.FirstName = row.ResolvedFirstName!;
                    employee.LastName = row.ResolvedLastName!;
                    // Listed again, so a person marked resigned by an earlier full-roster import is back at work.
                    employee.ResignedAt = null;
                    // Blank line columns keep the current roster data; the group check below fixes anything the group no longer covers.
                    if (row.ResolvedProductionLineId != null) ApplyProductionFields(employee, row);

                    if (newGroupsByCode.TryGetValue(row.GroupCode!, out var newGroupEntity)) employee.Group = newGroupEntity;
                    else employee.GroupId = groupPlans[row.GroupCode!].ExistingId!.Value;

                    if (row.IsNewEmployee)
                    {
                        await _unitOfWork.Employees.AddAsync(employee);
                        result.CreatedEmployeeCount++;
                    }
                    else
                    {
                        // The file has no accumulation/UserName columns, so re-import must not wipe them.
                        _unitOfWork.Employees.Update(employee);
                        result.UpdatedEmployeeCount++;
                    }
                }

                await _unitOfWork.SaveChangesAsync();

                // New groups take the Line × Ca of their rows, so everyone carries line data.
                foreach (var (code, newGroup) in newGroupsByCode)
                {
                    var pairs = validRows.Where(r => string.Equals(r.GroupCode, code, StringComparison.OrdinalIgnoreCase) && r.ResolvedProductionLineId != null)
                        .Select(r => (LineId: r.ResolvedProductionLineId!.Value, ShiftId: r.ResolvedShiftTeamId!.Value)).Distinct().ToList();
                    foreach (var (lineId, shiftId) in pairs)
                        newGroup.GroupLines.Add(new GroupLine { ProductionLineId = lineId, ShiftTeamId = shiftId });
                    await GroupLineDefaults.EnsureLinesAsync(_unitOfWork, newGroup);
                    await GroupLineDefaults.AssignCodeAsync(_unitOfWork, newGroup);
                    await _unitOfWork.SaveChangesAsync();
                }
                var defaultedCodes = validRows.Where(r => r.ResolvedProductionLineId == null).Select(r => r.EmployeeCode!).ToList();
                foreach (var employee in await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && defaultedCodes.Contains(x.Code)))
                    await GroupLineDefaults.ApplyAsync(_unitOfWork, employee);

                var resignedCodes = removedRows.Select(x => x.EmployeeCode).ToList();
                var resignedAt = TimeHelper.GetCurrentUtcTime();
                foreach (var employee in await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && x.ResignedAt == null && resignedCodes.Contains(x.Code)))
                    employee.ResignedAt = resignedAt;
                result.ResignedCount = removedRows.Count;

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

        private static void ApplyProductionFields(Employee employee, EmployeeImportRowDto row)
        {
            employee.ProductionLineId = row.ResolvedProductionLineId;
            employee.TeamId = row.ResolvedTeamId;
            employee.ShiftTeamId = row.ResolvedShiftTeamId;
            employee.StaffKind = row.StaffKind;
            employee.CongDoan = row.CongDoan;
            employee.TaskName = row.TaskName;
        }

        private sealed class DepartmentResolution
        {
            public int? ExistingId { get; set; }
            public string Name { get; set; } = null!;
            public bool HasConflict { get; set; }
        }

        private sealed class GroupResolution
        {
            public string Code { get; set; } = null!;
            public int? ExistingId { get; set; }
            public int? ExistingDepartmentId { get; set; }
            public string Name { get; set; } = null!;
            public string DepartmentCode { get; set; } = null!;
            public bool HasConflict { get; set; }
            public int? ExistingWorkshopId { get; set; }
            // Workshop a new group is created in: the workshop of its first row.
            public int? NewWorkshopId { get; set; }
            public List<(int LineId, int ShiftTeamId)> Lines { get; set; } = new();
        }

        private sealed record ExistingGroup(int Id, string GroupCode, string GroupNameVn, int DepartmentId, int WorkshopId, string DepartmentCode,
            List<(int LineId, int ShiftTeamId)> Lines);

        private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private async Task<(List<EmployeeImportRowDto> Rows, Dictionary<string, DepartmentResolution> Departments, Dictionary<string, GroupResolution> Groups, List<EmployeeImportRemovedRowDto> RemovedRows)>
            ValidateAndResolveRowsAsync(List<EmployeeImportRowDto> rawRows, EmployeeImportMode mode, string userName, bool isAdmin)
        {
            // Department coordinators only: a group coordinator cannot vouch for a whole department's roster.
            var managedDepartmentIds = isAdmin ? null : await _departmentAccessGuard.GetManagedDepartmentIdsAsync(userName);
            if (managedDepartmentIds is { Count: 0 })
                throw new DomainException("Chỉ Admin và Người phụ trách Bộ phận được import nhân sự.");
            bool InCallerScope(int? departmentId) => isAdmin || (departmentId.HasValue && managedDepartmentIds!.Contains(departmentId.Value));

            var existingDepartments = await _unitOfWork.Departments.SelectAsync(
                x => !x.IsDeleted, x => new { x.Id, x.DepartmentCode, x.DepartmentNameVn });
            var departmentNameByCode = existingDepartments.ToDictionary(x => x.DepartmentCode, x => x.DepartmentNameVn, StringComparer.OrdinalIgnoreCase);
            var existingGroups = (await _unitOfWork.Groups.SelectAsync(
                x => !x.IsDeleted, x => new { x.Id, x.GroupCode, x.GroupNameVn, x.DepartmentId, x.WorkshopId, DepartmentCode = x.Department.DepartmentCode,
                    Lines = x.GroupLines.Select(l => new { l.ProductionLineId, l.ShiftTeamId }).ToList() }))
                .Select(x => new ExistingGroup(x.Id, x.GroupCode, x.GroupNameVn, x.DepartmentId, x.WorkshopId, x.DepartmentCode,
                    x.Lines.Select(l => (l.ProductionLineId, l.ShiftTeamId)).ToList()))
                .ToList();
            var codesInFile = rawRows.Where(r => !string.IsNullOrWhiteSpace(r.EmployeeCode))
                .Select(r => r.EmployeeCode!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var existingEmployees = (await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && codesInFile.Contains(x.Code),
                x => new
                {
                    x.Code,
                    x.GroupId,
                    x.StaffKind,
                    x.ProductionLineId,
                    x.ShiftTeamId,
                    DepartmentId = x.DepartmentId ?? (x.Group != null ? (int?)x.Group.DepartmentId : null),
                    WorkshopId = x.Group != null ? (int?)x.Group.WorkshopId : null,
                    TerminalLevel = x.JobTitle != null ? x.JobTitle.TerminalLevel : (int)JobTitleTerminalLevel.None
                }))
                .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

            var lines = await _unitOfWork.ProductionLines.SelectAsync(x => !x.IsDeleted,
                x => new { x.Id, x.WorkshopId, x.LineCode, x.TeamId });
            var shiftTeams = await _unitOfWork.ProductionShiftTeams.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.Code });
            var workshops = await _unitOfWork.Workshops.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.WorkshopCode });
            var tasksByKey = (await _unitOfWork.ProductionTasks.SelectAsync(x => !x.IsDeleted, x => new { x.WorkshopId, x.Code, x.StaffKind }))
                .ToDictionary(x => (x.WorkshopId, x.Code.Trim().ToUpperInvariant()));
            var linesByKey = lines.ToDictionary(x => (x.WorkshopId, x.LineCode.Trim().ToUpperInvariant()));
            var lineWorkshopsByCode = lines.ToLookup(x => x.LineCode.Trim().ToUpperInvariant(), x => x.WorkshopId);
            var shiftTeamsByCode = shiftTeams.ToDictionary(x => x.Code.Trim(), x => x.Id, StringComparer.OrdinalIgnoreCase);
            var lineCodeById = lines.ToDictionary(x => x.Id, x => x.LineCode.Trim());
            var shiftTeamCodeById = shiftTeams.ToDictionary(x => x.Id, x => x.Code.Trim());
            var workshopCodeById = workshops.ToDictionary(x => x.Id, x => x.WorkshopCode);
            var workshopIdByCode = workshops.ToDictionary(x => x.WorkshopCode.Trim(), x => x.Id, StringComparer.OrdinalIgnoreCase);
            var defaultWorkshopId = workshops.Select(x => x.Id).DefaultIfEmpty().Min();

            var duplicatedEmployeeCodesInFile = FindDuplicates(rawRows, r => r.EmployeeCode);

            // Phase 1: collect Department/Group codes and detect conflicts (same new code with different names,
            // or a Group code already under another Department).
            var departmentPlans = new Dictionary<string, DepartmentResolution>(StringComparer.OrdinalIgnoreCase);
            var groupPlans = new Dictionary<string, GroupResolution>(StringComparer.OrdinalIgnoreCase);
            GroupResolution PlanFor(ExistingGroup g)
            {
                if (!groupPlans.TryGetValue(g.GroupCode, out var plan))
                    groupPlans[g.GroupCode] = plan = new GroupResolution
                    {
                        Code = g.GroupCode, ExistingId = g.Id, ExistingDepartmentId = g.DepartmentId, Name = g.GroupNameVn, DepartmentCode = g.DepartmentCode,
                        ExistingWorkshopId = g.WorkshopId, Lines = g.Lines
                    };
                return plan;
            }

            foreach (var row in rawRows)
            {
                var deptCode = Clean(row.DepartmentCode);
                var deptName = Clean(row.DepartmentNameVn);
                if (deptCode != null && !departmentPlans.ContainsKey(deptCode))
                {
                    if (departmentNameByCode.TryGetValue(deptCode, out var existingName))
                        departmentPlans[deptCode] = new DepartmentResolution { ExistingId = existingDepartments.First(d => string.Equals(d.DepartmentCode, deptCode, StringComparison.OrdinalIgnoreCase)).Id, Name = existingName };
                    else if (deptName != null)
                        departmentPlans[deptCode] = new DepartmentResolution { Name = deptName };
                }
                else if (deptCode != null && deptName != null && departmentPlans[deptCode] is { ExistingId: null } newDept
                         && !string.Equals(newDept.Name, deptName, StringComparison.OrdinalIgnoreCase))
                {
                    newDept.HasConflict = true;
                }

                var groupCode = Clean(row.GroupCode);
                var groupName = Clean(row.GroupNameVn);
                if (groupCode == null) continue;
                if (!groupPlans.TryGetValue(groupCode, out var groupPlan))
                {
                    var existing = existingGroups.FirstOrDefault(g => string.Equals(g.GroupCode, groupCode, StringComparison.OrdinalIgnoreCase));
                    if (existing != null)
                        groupPlan = PlanFor(existing);
                    else if (groupName != null && deptCode != null)
                        groupPlans[groupCode] = groupPlan = new GroupResolution { Code = groupCode, Name = groupName, DepartmentCode = deptCode };
                    else continue;
                    if (existing != null && deptCode != null && !string.Equals(existing.DepartmentCode, deptCode, StringComparison.OrdinalIgnoreCase))
                        groupPlan.HasConflict = true;
                }
                else
                {
                    if (groupPlan.ExistingId == null && groupName != null && !string.Equals(groupPlan.Name, groupName, StringComparison.OrdinalIgnoreCase))
                        groupPlan.HasConflict = true;
                    if (deptCode != null && !string.Equals(groupPlan.DepartmentCode, deptCode, StringComparison.OrdinalIgnoreCase))
                        groupPlan.HasConflict = true;
                }
            }

            // Phase 2: validate each employee row, referencing the Department/Group plans built above.
            var result = new List<EmployeeImportRowDto>();
            foreach (var row in rawRows)
            {
                var errors = new List<string>();
                var employeeCode = Clean(row.EmployeeCode);
                var fullName = Clean(row.FullName);
                var deptCode = Clean(row.DepartmentCode);
                var groupCode = Clean(row.GroupCode);
                var workshopCode = Clean(row.WorkshopCode);
                var existingEmployee = employeeCode == null ? null : existingEmployees.GetValueOrDefault(employeeCode);

                if (employeeCode == null)
                    errors.Add("Thiếu mã nhân viên.");
                // Duplicates within the file are errors; codes already in the DB are updated on Confirm.
                else if (duplicatedEmployeeCodesInFile.Contains(employeeCode))
                    errors.Add($"Mã nhân viên '{employeeCode}' bị lặp lại nhiều dòng trong file.");

                string? resolvedFirstName = null;
                string? resolvedLastName = null;
                if (fullName == null)
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

                DepartmentResolution? fileDepartment = null;
                if (deptCode != null)
                {
                    fileDepartment = departmentPlans.GetValueOrDefault(deptCode);
                    if (fileDepartment == null)
                        errors.Add($"Phòng ban '{deptCode}' chưa có trong hệ thống — ghi thêm Tên phòng để tạo mới.");
                    else if (fileDepartment.HasConflict)
                        errors.Add($"Phòng ban mã '{deptCode}' có tên không nhất quán giữa các dòng trong file.");
                }
                GroupResolution? fileGroup = null;
                if (groupCode != null)
                {
                    fileGroup = groupPlans.GetValueOrDefault(groupCode);
                    if (fileGroup == null)
                        errors.Add($"Nhóm '{groupCode}' chưa có trong hệ thống — ghi thêm Tên nhóm, Mã và Tên phòng để tạo mới.");
                    else if (fileGroup.HasConflict)
                        errors.Add($"Nhóm mã '{groupCode}' có tên hoặc phòng ban không nhất quán giữa các dòng trong file, hoặc đã thuộc 1 phòng ban khác trong hệ thống.");
                }

                var lineCode = Clean(row.LineCode);
                var teamCode = Clean(row.TeamCode);
                var shiftTeamCode = Clean(row.ShiftTeamCode);
                var congDoan = Clean(row.CongDoan);
                var taskName = Clean(row.TaskName);
                var fileKind = StaffKinds.Normalize(row.StaffKind);

                // Line codes repeat across workshops: the Xưởng column, else the file group's, else the only workshop
                // having the line, else the employee's current one.
                int? rowWorkshopId = null;
                if (workshopCode != null)
                {
                    if (workshopIdByCode.TryGetValue(workshopCode, out var fileWorkshopId)) rowWorkshopId = fileWorkshopId;
                    else errors.Add($"Xưởng '{workshopCode}' không có trong danh mục.");
                }
                else if (fileGroup?.ExistingWorkshopId != null)
                    rowWorkshopId = fileGroup.ExistingWorkshopId;
                else if (lineCode != null)
                {
                    var lineWorkshops = lineWorkshopsByCode[lineCode.ToUpperInvariant()].Distinct().ToList();
                    if (lineWorkshops.Count == 1) rowWorkshopId = lineWorkshops[0];
                    else if (existingEmployee?.WorkshopId is int currentWorkshopId && lineWorkshops.Contains(currentWorkshopId)) rowWorkshopId = currentWorkshopId;
                    else if (lineWorkshops.Count > 1) errors.Add($"Line '{lineCode}' có ở nhiều Xưởng — ghi cột Xưởng.");
                }
                var workshopId = rowWorkshopId ?? existingEmployee?.WorkshopId ?? defaultWorkshopId;

                // The task decides TT/GT; the TT/GT column only counts for rows without one.
                string? taskKind = null;
                if (taskName != null)
                {
                    if (tasksByKey.TryGetValue((workshopId, taskName.ToUpperInvariant()), out var task)) (taskName, taskKind) = (task.Code, task.StaffKind);
                    else errors.Add($"Công việc '{taskName}' chưa có trong danh mục của xưởng {workshopCodeById.GetValueOrDefault(workshopId)} — thêm ở Danh mục > Tổ chức > Công việc.");
                }

                int? lineId = null, teamId = null, shiftTeamId = null;
                if (taskKind == null && fileKind != null && fileKind != StaffKinds.Direct && fileKind != StaffKinds.Indirect)
                    errors.Add($"Cột TT/GT chỉ nhận TT hoặc GT (đang là '{row.StaffKind}').");
                var staffKind = taskKind ?? (fileKind is StaffKinds.Direct or StaffKinds.Indirect ? fileKind : null) ?? existingEmployee?.StaffKind;
                var lineColumnsUsed = lineCode != null || teamCode != null || shiftTeamCode != null || congDoan != null || taskName != null || fileKind != null;
                if (lineCode != null && shiftTeamCode != null)
                {
                    if (shiftTeamsByCode.TryGetValue(shiftTeamCode, out var foundShiftTeam)) shiftTeamId = foundShiftTeam;
                    else errors.Add($"Nhóm ca '{shiftTeamCode}' không có trong danh mục.");
                    if (!linesByKey.TryGetValue((workshopId, lineCode.ToUpperInvariant()), out var line))
                        errors.Add($"Line '{lineCode}' không có trong danh mục của xưởng {workshopCodeById.GetValueOrDefault(workshopId)}.");
                    else
                    {
                        // Team is the area a line sits in, so it follows the catalog; the file's Team column is informational.
                        lineId = line.Id;
                        teamId = line.TeamId;
                    }
                }
                else if (lineColumnsUsed)
                {
                    errors.Add("Dữ liệu dưới chuyền phải có đủ Line và Nhóm ca.");
                }

                // Group = Line × Ca inside a department; the group code only decides when Add mode names it
                // or the row has no line data.
                GroupResolution? target = null;
                var hasPair = lineId.HasValue && shiftTeamId.HasValue;
                var pair = hasPair ? (lineId!.Value, shiftTeamId!.Value) : default;
                var pairLabel = hasPair ? $"Line {lineCodeById[pair.Item1]} · Ca {shiftTeamCodeById[pair.Item2]}" : "";
                if (groupCode != null && fileGroup is null or { HasConflict: true })
                {
                    // Already reported above.
                }
                else if (mode == EmployeeImportMode.Add && fileGroup != null)
                {
                    target = fileGroup;
                    if (hasPair && fileGroup.ExistingId != null && !fileGroup.Lines.Contains(pair))
                        errors.Add($"{pairLabel} không thuộc Nhóm '{fileGroup.Code}' — thêm ở màn Nhóm, hoặc bỏ Mã nhóm để tự xác định Nhóm.");
                }
                else if (hasPair)
                {
                    // A line may serve several departments (PRO and QA KENSA share lines), so the department narrows the match.
                    var departmentFilterSet = fileDepartment != null || fileGroup?.ExistingDepartmentId != null;
                    var departmentFilter = fileDepartment != null ? fileDepartment.ExistingId : fileGroup?.ExistingDepartmentId;
                    var candidates = existingGroups.Where(g => g.WorkshopId == workshopId && g.Lines.Contains(pair)
                        && (!departmentFilterSet || g.DepartmentId == departmentFilter)).ToList();
                    if (candidates.Count > 1 && existingEmployee?.DepartmentId is int currentDepartmentId && candidates.Any(g => g.DepartmentId == currentDepartmentId))
                        candidates = candidates.Where(g => g.DepartmentId == currentDepartmentId).ToList();
                    var pick = candidates.Count == 1 ? candidates[0] : candidates.FirstOrDefault(g => g.Id == fileGroup?.ExistingId);
                    if (pick != null)
                        target = PlanFor(pick);
                    else if (candidates.Count > 1)
                        errors.Add($"Có nhiều Nhóm gắn {pairLabel}: {string.Join(", ", candidates.Select(x => $"{x.GroupCode} ({x.DepartmentCode})"))} — ghi Mã phòng hoặc Mã nhóm.");
                    else if (fileGroup is { ExistingId: null })
                        target = fileGroup;
                    else
                        errors.Add($"Chưa có Nhóm nào gắn {pairLabel}{(fileDepartment != null ? $" ở phòng {deptCode}" : "")} — thêm Line × Ca cho Nhóm ở màn Nhóm.");
                }
                else if (fileGroup != null)
                    target = fileGroup;
                else if (!lineColumnsUsed && existingEmployee?.GroupId is int currentGroupId && existingGroups.FirstOrDefault(g => g.Id == currentGroupId) is { } currentGroup)
                    target = PlanFor(currentGroup);
                else if (!lineColumnsUsed)
                    errors.Add("Thiếu Mã nhóm hoặc Line + Nhóm ca.");

                var isNewGroup = target is { ExistingId: null };
                var isNewDepartment = isNewGroup && departmentPlans.GetValueOrDefault(target!.DepartmentCode)?.ExistingId == null;
                if (isNewGroup)
                {
                    // A new group takes the Line × Ca of its rows on Confirm, so its rows must agree on workshop.
                    target!.NewWorkshopId ??= workshopId;
                    if (target.NewWorkshopId != workshopId)
                        errors.Add($"Nhóm mới '{target.Code}' có dòng ở nhiều Xưởng.");
                }
                // Blank line columns keep the person's pair only when the group still covers it; otherwise one pair must be obvious.
                else if (target != null && !lineColumnsUsed && target.Lines.Count > 1
                         && !(existingEmployee is { ProductionLineId: int currentLineId, ShiftTeamId: int currentShiftId } && target.Lines.Contains((currentLineId, currentShiftId))))
                    errors.Add($"Nhóm '{target.Code}' gắn nhiều Line × Ca — ghi Line và Nhóm ca cho người này.");

                if (target != null && !isNewGroup && !InCallerScope(target.ExistingDepartmentId))
                    errors.Add($"Nhóm '{target.Code}' không thuộc phạm vi bạn phụ trách.");
                if (!isAdmin && isNewDepartment)
                    errors.Add($"Chỉ Admin được tạo Bộ phận mới '{target!.DepartmentCode}'.");
                if (!isAdmin && isNewGroup)
                    errors.Add($"Chỉ Admin được tạo Nhóm mới '{target!.Code}'.");
                if (existingEmployee != null && !InCallerScope(existingEmployee.DepartmentId))
                    errors.Add($"Nhân viên '{employeeCode}' đang thuộc đơn vị ngoài phạm vi bạn phụ trách.");
                // Import would put a manager into a Group, breaking the job-title organisation rules.
                if (existingEmployee != null && existingEmployee.TerminalLevel != (int)JobTitleTerminalLevel.None)
                    errors.Add("Nhân viên giữ chức vụ Trưởng phòng trở lên — sửa ở màn Nhân viên, không qua import.");

                var resolvedDepartmentCode = target?.DepartmentCode ?? deptCode;
                result.Add(new EmployeeImportRowDto
                {
                    RowNumber = row.RowNumber,
                    EmployeeCode = employeeCode,
                    FullName = fullName,
                    DepartmentCode = resolvedDepartmentCode,
                    DepartmentNameVn = resolvedDepartmentCode == null ? null
                        : departmentPlans.GetValueOrDefault(resolvedDepartmentCode)?.Name ?? departmentNameByCode.GetValueOrDefault(resolvedDepartmentCode),
                    GroupCode = target?.Code ?? groupCode,
                    GroupNameVn = target?.Name ?? Clean(row.GroupNameVn),
                    WorkshopCode = workshopCodeById.GetValueOrDefault(target?.ExistingWorkshopId ?? workshopId),
                    LineCode = lineCode,
                    TeamCode = teamCode,
                    ShiftTeamCode = shiftTeamCode,
                    StaffKind = staffKind,
                    CongDoan = congDoan,
                    TaskName = taskName,
                    ResolvedProductionLineId = lineId,
                    ResolvedTeamId = teamId,
                    ResolvedShiftTeamId = shiftTeamId,
                    ResolvedFirstName = resolvedFirstName,
                    ResolvedLastName = resolvedLastName,
                    IsNewDepartment = isNewDepartment,
                    IsNewGroup = isNewGroup,
                    IsNewEmployee = employeeCode != null && existingEmployee == null,
                    IsValid = errors.Count == 0,
                    Errors = errors
                });
            }

            // Only Overwrite treats the file as the full roster, and only of departments with at least one valid row.
            var removedRows = new List<EmployeeImportRemovedRowDto>();
            if (mode == EmployeeImportMode.Overwrite)
            {
                var coveredDepartmentIds = result.Where(r => r.IsValid && !r.IsNewGroup)
                    .Select(r => groupPlans[r.GroupCode!].ExistingDepartmentId!.Value).Distinct().ToList();
                var absentFromFile = await _unitOfWork.Employees.SelectAsync(
                    x => !x.IsDeleted && x.ResignedAt == null && x.Group != null && coveredDepartmentIds.Contains(x.Group.DepartmentId)
                         && !codesInFile.Contains(x.Code) && (x.JobTitle == null || x.JobTitle.TerminalLevel == (int)JobTitleTerminalLevel.None),
                    x => new { x.Code, FullName = x.LastName + " " + x.FirstName, x.Group!.DepartmentId, x.Group.GroupNameVn,
                        LineCode = x.ProductionLine != null ? x.ProductionLine.LineCode : null });
                removedRows = absentFromFile
                    .Where(x => InCallerScope(x.DepartmentId))
                    .OrderBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
                    .Select(x => new EmployeeImportRemovedRowDto { EmployeeCode = x.Code, FullName = x.FullName, GroupNameVn = x.GroupNameVn, LineCode = x.LineCode })
                    .ToList();
            }

            return (result, departmentPlans, groupPlans, removedRows);
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

        // A=ignored, B=MNV, C=HO Ten, D/E=Department code/name, F/G=Group code/name, H=Line, I=Team, J=shift team,
        // K=CongDoan, L=TaskName, M=TT/GT, N=Xưởng.
        private const string HeaderMarkerCellB = "MNV";

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
                var lineCode = worksheet.Cell(xlRow.RowNumber(), 8).GetString().Trim();
                var teamCode = worksheet.Cell(xlRow.RowNumber(), 9).GetString().Trim();
                var shiftTeamCode = worksheet.Cell(xlRow.RowNumber(), 10).GetString().Trim();
                var congDoan = worksheet.Cell(xlRow.RowNumber(), 11).GetString().Trim();
                var taskName = worksheet.Cell(xlRow.RowNumber(), 12).GetString().Trim();
                var staffKind = worksheet.Cell(xlRow.RowNumber(), 13).GetString().Trim();
                var workshopCode = worksheet.Cell(xlRow.RowNumber(), 14).GetString().Trim();

                string[] allCells = [employeeCode, fullName, departmentCode, departmentName, groupCode, groupName, lineCode, teamCode, shiftTeamCode, congDoan, taskName, staffKind, workshopCode];
                if (allCells.All(string.IsNullOrWhiteSpace)) continue;

                rows.Add(new EmployeeImportRowDto
                {
                    RowNumber = xlRow.RowNumber(),
                    EmployeeCode = string.IsNullOrWhiteSpace(employeeCode) ? null : employeeCode,
                    FullName = string.IsNullOrWhiteSpace(fullName) ? null : fullName,
                    DepartmentCode = string.IsNullOrWhiteSpace(departmentCode) ? null : departmentCode,
                    DepartmentNameVn = string.IsNullOrWhiteSpace(departmentName) ? null : departmentName,
                    GroupCode = string.IsNullOrWhiteSpace(groupCode) ? null : groupCode,
                    GroupNameVn = string.IsNullOrWhiteSpace(groupName) ? null : groupName,
                    LineCode = string.IsNullOrWhiteSpace(lineCode) ? null : lineCode,
                    TeamCode = string.IsNullOrWhiteSpace(teamCode) ? null : teamCode,
                    ShiftTeamCode = string.IsNullOrWhiteSpace(shiftTeamCode) ? null : shiftTeamCode,
                    CongDoan = string.IsNullOrWhiteSpace(congDoan) ? null : congDoan,
                    TaskName = string.IsNullOrWhiteSpace(taskName) ? null : taskName,
                    StaffKind = string.IsNullOrWhiteSpace(staffKind) ? null : staffKind,
                    WorkshopCode = string.IsNullOrWhiteSpace(workshopCode) ? null : workshopCode
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
        private const string MonthlyAccumulationHeaderMarkerCellB = "MNV";

        public async Task<ProductionEmployeeAccumulationResultDto> ImportMonthlyAccumulationAsync(
            Stream excelFileStream, int year, int month, string userName, bool isAdmin)
        {
            using var workbook = OpenWorkbook(excelFileStream);
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

            var (employeesByCode, scope, ledger) = await LoadAccumulationContextAsync(dataRows.Select(r => r.EmployeeCode), year, userName, isAdmin);
            var note = $"Điều chỉnh từ import lũy kế OT theo tháng/năm ngày {TimeHelper.GetCurrentUtcTime():dd/MM/yyyy HH:mm}";

            foreach (var row in dataRows)
            {
                var employee = ResolveAccumulationEmployee(row.EmployeeCode, employeesByCode, scope, result);
                if (employee == null) continue;

                var changedMonth = false;
                var changedYear = false;

                // Monthly accumulation (column C).
                if (row.TotalHours.HasValue)
                {
                    var deltaMonth = await ledger.SetMonthTotalAsync(employee.Id, month, row.TotalHours.Value, note, note);
                    if (deltaMonth != 0)
                    {
                        result.AdjustedCount++;
                        result.TotalDeltaHours += deltaMonth;
                        changedMonth = true;
                    }
                }

                // Yearly accumulation (column D) goes to the opening-balance row (Month = 0) so months 1..12 stay actual.
                if (row.YearHours.HasValue)
                {
                    var deltaYear = row.YearHours.Value - ledger.YearTotal(employee.Id);
                    if (deltaYear != 0)
                    {
                        await ledger.SetMonthTotalAsync(employee.Id, 0, ledger.MonthTotal(employee.Id, 0) + deltaYear, note,
                            $"Số dư lũy kế đầu kỳ/các tháng trước từ import ngày {TimeHelper.GetCurrentUtcTime():dd/MM/yyyy HH:mm}");
                        result.AdjustedYearCount++;
                        result.TotalDeltaYearHours += deltaYear;
                        changedYear = true;
                    }
                }

                if (!changedMonth && !changedYear) result.UnchangedCount++;
            }

            await _unitOfWork.SaveChangesAsync();
            return result;
        }

        // Columns are found by header text, so both the system template (data from column B) and a hand-made sheet
        // (code in column A, then name/group, then T1..T12) import as-is; name, group and total columns are ignored.
        private static readonly string[] EmployeeCodeHeaders = { "MNV", "Mã NV", "Mã nhân viên" };
        private static readonly System.Text.RegularExpressions.Regex MonthHeaderPattern = new(@"^T0?(\d{1,2})(?:/(\d{4}))?$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

        public async Task<ProductionEmployeeAccumulationResultDto> ImportYearlyAccumulationAsync(
            Stream excelFileStream, int year, string userName, bool isAdmin)
        {
            using var workbook = OpenWorkbook(excelFileStream);
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var result = new ProductionEmployeeAccumulationResultDto();
            if (usedRange == null) return result;

            var allUsedRows = usedRange.RowsUsed().ToList();
            int? headerRowNumber = null, codeColumn = null;
            var monthColumns = new Dictionary<int, int>();
            foreach (var row in allUsedRows)
            {
                int? rowCodeColumn = null;
                var rowMonthColumns = new Dictionary<int, int>();
                foreach (var cell in row.CellsUsed())
                {
                    var text = cell.GetString().Trim();
                    if (EmployeeCodeHeaders.Contains(text, StringComparer.OrdinalIgnoreCase))
                    {
                        rowCodeColumn ??= cell.Address.ColumnNumber;
                        continue;
                    }

                    var match = MonthHeaderPattern.Match(text);
                    if (!match.Success) continue;
                    var month = int.Parse(match.Groups[1].Value);
                    if (month < 1 || month > 12) continue;
                    if (match.Groups[2].Success && int.Parse(match.Groups[2].Value) != year)
                        throw new DomainException($"Cột \"{text}\" thuộc năm {match.Groups[2].Value}, khác năm đang chọn ({year}).");
                    if (!rowMonthColumns.TryAdd(month, cell.Address.ColumnNumber))
                        throw new DomainException($"File có 2 cột cho tháng {month}.");
                }

                if (rowCodeColumn == null || rowMonthColumns.Count == 0) continue;
                headerRowNumber = row.RowNumber();
                codeColumn = rowCodeColumn;
                monthColumns = rowMonthColumns;
                break;
            }

            if (headerRowNumber == null)
                throw new DomainException("Không tìm thấy dòng tiêu đề: cần một cột \"MNV\" (hoặc \"Mã nhân viên\") và các cột tháng \"T1\"…\"T12\".");

            var dataRows = new List<(string EmployeeCode, Dictionary<int, decimal> Hours)>();
            foreach (var row in allUsedRows.Where(r => r.RowNumber() > headerRowNumber))
            {
                var code = worksheet.Cell(row.RowNumber(), codeColumn!.Value).GetString().Trim();
                // The summary row of a hand-made sheet is not an employee.
                if (string.IsNullOrEmpty(code) || code.Equals("Tổng", StringComparison.OrdinalIgnoreCase)) continue;

                var hours = new Dictionary<int, decimal>();
                string? error = null;
                foreach (var (month, column) in monthColumns)
                {
                    var cell = worksheet.Cell(row.RowNumber(), column);
                    if (cell.IsEmpty()) continue;
                    if (!cell.TryGetValue<decimal>(out var value)) error = $"Giờ tháng {month} không phải số.";
                    else if (value < 0) error = $"Giờ tháng {month} không được âm.";
                    else hours[month] = value;
                }

                if (error != null)
                {
                    result.SkippedCount++;
                    result.SkippedRows.Add(new ProductionEmployeeAccumulationSkippedRowDto { EmployeeCode = code, Reason = error });
                    continue;
                }
                if (hours.Count > 0) dataRows.Add((code, hours));
            }

            if (dataRows.Count == 0) return result;

            // A month that hasn't started has no OT yet; this catches a year-total column labelled as T12.
            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var future = dataRows
                .SelectMany(r => r.Hours.Where(h => h.Value != 0 && (year > today.Year || (year == today.Year && h.Key > today.Month)))
                    .Select(h => (r.EmployeeCode, Month: h.Key)))
                .FirstOrDefault();
            if (future.EmployeeCode != null)
                throw new DomainException(
                    $"Tháng {future.Month}/{year} chưa tới nhưng file có giờ (vd. MNV {future.EmployeeCode}). Kiểm tra lại cột T{future.Month} — có thể đang là cột tổng năm. Không có dữ liệu nào được ghi.");

            var (employeesByCode, scope, ledger) = await LoadAccumulationContextAsync(dataRows.Select(r => r.EmployeeCode), year, userName, isAdmin);
            var note = $"Điều chỉnh từ import lũy kế OT cả năm ngày {TimeHelper.GetCurrentUtcTime():dd/MM/yyyy HH:mm}";

            foreach (var row in dataRows)
            {
                var employee = ResolveAccumulationEmployee(row.EmployeeCode, employeesByCode, scope, result);
                if (employee == null) continue;

                // +2h in one month and -2h in another is still a change, so track it per month.
                var changed = false;
                foreach (var (month, target) in row.Hours)
                {
                    var delta = await ledger.SetMonthTotalAsync(employee.Id, month, target, note, note);
                    if (delta == 0) continue;
                    changed = true;
                    result.TotalDeltaHours += delta;
                }

                if (changed) result.AdjustedCount++;
                else result.UnchangedCount++;
            }

            await _unitOfWork.SaveChangesAsync();
            return result;
        }

        private static XLWorkbook OpenWorkbook(Stream excelFileStream)
        {
            try
            {
                return new XLWorkbook(excelFileStream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                throw new DomainException(
                    "File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx).",
                    new List<string> { $"{ex.GetType().Name}: {ex.Message}" });
            }
        }

        private sealed record AccumulationEmployee(int Id, string Code, int? GroupId, int? DepartmentId);

        // null = Admin (no limit); otherwise the departments/groups the caller coordinates.
        private sealed record AccumulationScope(HashSet<int> DepartmentIds, HashSet<int> GroupIds);

        private async Task<(Dictionary<string, AccumulationEmployee> EmployeesByCode, AccumulationScope? Scope, YearLedger Ledger)>
            LoadAccumulationContextAsync(IEnumerable<string> employeeCodes, int year, string userName, bool isAdmin)
        {
            var codes = employeeCodes.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var employeesByCode = (await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && codes.Contains(x.Code),
                x => new AccumulationEmployee(x.Id, x.Code, x.GroupId, x.DepartmentId ?? (x.Group != null ? (int?)x.Group.DepartmentId : null))))
                .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

            // Scoped per row, same rules as ImportOtHourLimitsAsync.
            AccumulationScope? scope = null;
            if (!isAdmin)
            {
                var managedGroupIds = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                    x => x.Employee.UserName == userName && !x.IsDeleted)).Select(x => x.GroupId).ToHashSet();
                scope = new AccumulationScope(
                    (await _departmentAccessGuard.GetManagedDepartmentIdsAsync(userName)).ToHashSet(), managedGroupIds);
            }

            var employeeIds = employeesByCode.Values.Select(x => x.Id).ToList();
            var ledgerRows = employeeIds.Count == 0
                ? new List<EmployeeAccumulationHistory>()
                : (await _unitOfWork.EmployeeAccumulationHistories.FindAsync(x => employeeIds.Contains(x.EmployeeId) && x.Year == year)).ToList();

            return (employeesByCode, scope, new YearLedger(_unitOfWork, year, ledgerRows));
        }

        // Unknown codes and employees outside the caller's scope land in SkippedRows.
        private static AccumulationEmployee? ResolveAccumulationEmployee(
            string employeeCode, Dictionary<string, AccumulationEmployee> employeesByCode, AccumulationScope? scope,
            ProductionEmployeeAccumulationResultDto result)
        {
            string? reason = null;
            if (!employeesByCode.TryGetValue(employeeCode, out var employee))
                reason = "Không tìm thấy nhân viên trong hệ thống.";
            else if (scope != null
                && !(employee.DepartmentId.HasValue && scope.DepartmentIds.Contains(employee.DepartmentId.Value))
                && !(employee.GroupId.HasValue && scope.GroupIds.Contains(employee.GroupId.Value)))
                reason = "Nhân viên không thuộc Phòng ban/Nhóm bạn phụ trách.";

            if (reason == null) return employee;
            result.SkippedCount++;
            result.SkippedRows.Add(new ProductionEmployeeAccumulationSkippedRowDto { EmployeeCode = employeeCode, Reason = reason });
            return null;
        }

        // One year of ledger rows. Totals are set by adding the difference, because (EmployeeId, Year, Month) is unique
        // and running the same file twice must not double-count.
        private sealed class YearLedger
        {
            private readonly IAttendanceUnitOfWork _unitOfWork;
            private readonly int _year;
            private readonly Dictionary<int, Dictionary<int, EmployeeAccumulationHistory>> _rowsByEmployee;

            public YearLedger(IAttendanceUnitOfWork unitOfWork, int year, IEnumerable<EmployeeAccumulationHistory> rows)
            {
                _unitOfWork = unitOfWork;
                _year = year;
                _rowsByEmployee = rows.GroupBy(x => x.EmployeeId)
                    .ToDictionary(g => g.Key, g => g.GroupBy(x => x.Month).ToDictionary(m => m.Key, m => m.First()));
            }

            private Dictionary<int, EmployeeAccumulationHistory> RowsOf(int employeeId) =>
                _rowsByEmployee.TryGetValue(employeeId, out var rows) ? rows : _rowsByEmployee[employeeId] = new();

            public decimal MonthTotal(int employeeId, int month) =>
                RowsOf(employeeId).TryGetValue(month, out var row) ? row.TotalHours : 0m;

            public decimal YearTotal(int employeeId) => RowsOf(employeeId).Values.Sum(x => x.TotalHours);

            // Returns the difference applied (0 = already at target).
            public async Task<decimal> SetMonthTotalAsync(int employeeId, int month, decimal target, string note, string newRowNote)
            {
                var rows = RowsOf(employeeId);
                var delta = target - (rows.TryGetValue(month, out var existing) ? existing.TotalHours : 0m);
                if (delta == 0) return 0;

                if (existing != null)
                {
                    existing.TotalHours += delta;
                    existing.Note = string.IsNullOrEmpty(existing.Note) ? note : existing.Note + "; " + note;
                    _unitOfWork.EmployeeAccumulationHistories.Update(existing);
                }
                else
                {
                    var row = new EmployeeAccumulationHistory { EmployeeId = employeeId, Year = _year, Month = month, TotalHours = delta, Note = newRowNote };
                    await _unitOfWork.EmployeeAccumulationHistories.AddAsync(row);
                    rows[month] = row;
                }
                return delta;
            }
        }

        private static readonly string[] EmployeeNotes =
        {
            "Mỗi dòng 1 nhân viên. Mã NV đã có → cập nhật; chưa có → tạo mới. Chọn chế độ trên màn import.",
            "Ghi đè: file là danh sách đầy đủ của Phòng ban. Có Line + Nhóm ca thì Nhóm tự xác định theo Line × Ca (Mã phòng, Mã nhóm có thể để trống). Người của Phòng ban có trong file nhưng không có dòng nào → đánh dấu Nghỉ việc.",
            "Thêm: chỉ cập nhật người có trong file. Có Mã nhóm → vào đúng Nhóm đó (Line × Ca ghi trong file phải thuộc Nhóm); không có → tự xác định theo Line × Ca.",
            "Line và Nhóm ca để trống → giữ Line × Ca hiện tại nếu Nhóm vẫn gắn, không thì lấy theo Nhóm. Team tự lấy theo Line. Xưởng để trống → theo Nhóm, rồi theo Xưởng duy nhất có Line đó, rồi Xưởng hiện tại.",
            "Công việc phải có trong danh mục Công việc của Xưởng (Danh mục > Tổ chức) và quyết định TT/GT; cột TT/GT chỉ dùng cho dòng không có Công việc.",
            "Không có Công việc: TT/GT theo cột TT/GT, trống thì giữ như hiện tại.",
            "Bộ phận/Nhóm chưa có trong hệ thống sẽ được tạo mới (chỉ Admin). Chỉ Admin và Người phụ trách Bộ phận được import, Người phụ trách chỉ trong Bộ phận mình.",
            "Nhân viên giữ chức vụ Trưởng phòng trở lên không import được — sửa ở màn Nhân viên.",
            "Tài khoản đăng nhập, email nhận thông báo, Chức vụ, chữ ký: dùng import Liên kết tài khoản.",
        };

        private static readonly ImportTemplateColumn[] EmployeeColumns =
        {
            new("MNV", 16, true, "@"),
            new("HO Ten", 28, true),
            new("Mã phòng", 14, false, "@"),
            new("Tên phòng", 26, false),
            new("Mã nhóm", 14, false, "@"),
            new("Tên nhóm", 26, false),
            new("Line", 12, false, "@"),
            new("Team", 10, false, "@"),
            new("Nhóm ca", 10, false, "@"),
            new("Công đoạn", 12, false),
            new("Công việc", 22, false),
            new("TT/GT", 8, false, "@", new[] { new ImportTemplateOption(StaffKinds.Direct, "Trực tiếp"), new ImportTemplateOption(StaffKinds.Indirect, "Gián tiếp") }),
            new("Xưởng", 8, false, "@"),
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
            columns[12] = columns[12] with { Options = (await _unitOfWork.Workshops.SelectAsync(x => !x.IsDeleted,
                x => new ImportTemplateOption(x.WorkshopCode, x.WorkshopNameVn))).OrderBy(x => x.Value).ToList() };
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

        private static readonly string[] YearlyAccumulationNotes =
        {
            "Chọn Năm trên màn import. Mỗi dòng 1 nhân viên, định danh bằng MNV; Họ và tên, Mã nhóm chỉ để đối chiếu.",
            "T1…T12: tổng giờ OT của từng tháng. Ô có số → lũy kế tháng đó được đặt đúng bằng số đó; ô trống → giữ nguyên tháng đó.",
            "Áp dụng ngay, không có bước xem trước; chạy lại cùng file không cộng trùng. Số dư đầu kỳ (nếu có) không bị đổi.",
        };

        private static readonly ImportTemplateColumn[] YearlyAccumulationColumns = new[]
            {
                new ImportTemplateColumn("MNV", 16, true, "@"),
                new ImportTemplateColumn("Họ và tên", 28, false),
                new ImportTemplateColumn("Mã nhóm", 12, false, "@"),
            }
            .Concat(Enumerable.Range(1, 12).Select(m => new ImportTemplateColumn($"T{m}", 9, false, "0.##")))
            .ToArray();

        private static string ExportStamp() => TimeHelper.GetCurrentUtcTime().AddHours(7).ToString("yyyyMMdd_HHmm");

        public async Task<(byte[] Content, string FileName)> GenerateTemplateAsync() => ImportTemplateBuilder.Build(
            "Nhan vien", "MẪU IMPORT NHÂN SỰ", EmployeeNotes, await EmployeeColumnsWithOptionsAsync(),
            new[] { new object?[] { "NV001", "Nguyễn Văn A", "PRO", "Chế tạo", "", "", "A1", "1", "G", "ATO", "Lắp ráp", "TT", "DA" } },
            "Mau_Import_NhanVien.xlsx");

        public (byte[] Content, string FileName) GenerateOtHourLimitTemplate() => ImportTemplateBuilder.Build(
            "Gioi han OT", "MẪU IMPORT GIỚI HẠN GIỜ TĂNG CA RIÊNG", OtHourLimitNotes, OtHourLimitColumns,
            Array.Empty<object?[]>(), "Mau_Import_GioiHanOT.xlsx");

        public (byte[] Content, string FileName) GenerateMonthlyAccumulationTemplate() => ImportTemplateBuilder.Build(
            "Luy ke OT", "MẪU IMPORT LŨY KẾ GIỜ TĂNG CA", MonthlyAccumulationNotes, MonthlyAccumulationColumns,
            Array.Empty<object?[]>(), "Mau_Import_LuyKeOT.xlsx");

        public (byte[] Content, string FileName) GenerateYearlyAccumulationTemplate() => ImportTemplateBuilder.Build(
            "Luy ke OT nam", "MẪU IMPORT LŨY KẾ GIỜ TĂNG CA CẢ NĂM (T1–T12)", YearlyAccumulationNotes, YearlyAccumulationColumns,
            Array.Empty<object?[]>(), "Mau_Import_LuyKeOT_CaNam.xlsx");

        public async Task<(byte[] Content, string FileName)> ExportEmployeesAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin)
        {
            // Managers and above have no Group and are rejected by this import, so they are not exported.
            var rows = (await _employeeService.GetForExportAsync(userName, isAdmin, filter))
                .Where(x => x.GroupCode != null && x.TerminalLevel == (int)JobTitleTerminalLevel.None)
                .Select(x => new object?[] { x.Code, x.FullName, x.DepartmentCode, x.DepartmentNameVn, x.GroupCode, x.GroupNameVn,
                    x.LineCode, x.TeamCode, x.ShiftTeamCode, x.CongDoan, x.TaskName, x.StaffKind, x.WorkshopCode })
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

        // Months without a ledger row export blank, so re-importing the file leaves them untouched.
        public async Task<(byte[] Content, string FileName)> ExportYearlyAccumulationAsync(
            EmployeeExportFilterDto filter, int year, string userName, bool isAdmin)
        {
            var employees = await _employeeService.GetForExportAsync(userName, isAdmin, filter);
            var codes = employees.Select(x => x.Code).ToList();
            var hoursByCodeAndMonth = (await _unitOfWork.EmployeeAccumulationHistories.SelectAsync(
                    x => x.Year == year && x.Month >= 1 && codes.Contains(x.Employee.Code),
                    x => new { x.Employee.Code, x.Month, x.TotalHours }))
                .ToDictionary(x => (x.Code, x.Month), x => x.TotalHours);

            var rows = employees
                .Select(x => new object?[] { x.Code, x.FullName, x.GroupCode }
                    .Concat(Enumerable.Range(1, 12).Select(m => hoursByCodeAndMonth.TryGetValue((x.Code, m), out var h) ? (object?)h : null))
                    .ToArray())
                .ToList();
            return ImportTemplateBuilder.Build("Luy ke OT nam", $"IMPORT LŨY KẾ GIỜ TĂNG CA — NĂM {year}", YearlyAccumulationNotes,
                YearlyAccumulationColumns, rows, $"LuyKeOT_{year}_CaNam_{ExportStamp()}.xlsx", rowsAreSamples: false);
        }
    }
}
