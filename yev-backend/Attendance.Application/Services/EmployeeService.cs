using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Dtos.Departments;
using Attendance.Application.Dtos.Workshops;
using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.Groups;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Constants;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class EmployeeService : BaseService<IAttendanceUnitOfWork>, IEmployeeService
    {
        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IAttendanceSettingService _attendanceSettingService;
        private readonly IDepartmentAccessGuard _departmentAccessGuard;

        public EmployeeService(
            IAttendanceUnitOfWork unitOfWork, IUserDirectoryService userDirectoryService,
            IAttendanceSettingService attendanceSettingService, IDepartmentAccessGuard departmentAccessGuard)
            : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _attendanceSettingService = attendanceSettingService;
            _departmentAccessGuard = departmentAccessGuard;
        }

        // Accumulation is computed from the ledger inside projections, always for today's real year/month.
        // The formula is repeated per query because EF can't translate an invoked shared Expression.
        private static (int Year, int Month) GetTodayYearMonth()
        {
            var today = DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            return (today.Year, today.Month);
        }

        // Employee.View is company-wide, so lists scope by position: directors all, managers their (department, workshop) pairs, others their group.
        // GroupIds already includes every group under a coordinated department or managed pair.
        private readonly record struct EmployeeScope(bool CompanyWide, HashSet<int> DepartmentIds, HashSet<int> GroupIds, HashSet<int> PairKeys);

        // Union of the caller's real position and every department/group they coordinate,
        // otherwise coordinators couldn't see the people they are allowed to edit.
        private async Task<EmployeeScope> ResolveCallerScopeAsync(string callerUserName)
        {
            var caller = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == callerUserName && !x.IsDeleted, x => x.JobTitle!);
            if (caller == null)
                throw new DomainException("Tài khoản của bạn chưa liên kết với hồ sơ Nhân viên nào.");

            var callerTerminalLevel = (JobTitleTerminalLevel)(caller.JobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);
            if (callerTerminalLevel == JobTitleTerminalLevel.WorkshopManager || callerTerminalLevel == JobTitleTerminalLevel.GeneralDirector)
                return new EmployeeScope(true, new HashSet<int>(), new HashSet<int>(), new HashSet<int>());

            var departmentIds = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);
            var groupIds = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                    x => x.Employee.UserName == callerUserName && !x.IsDeleted))
                .Select(x => x.GroupId)
                .ToHashSet();

            var callerScopes = await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == caller.Id);
            var pairKeys = callerScopes.Select(x => ScopeKey.Of(x.DepartmentId, x.WorkshopId)).ToHashSet();
            if (caller.GroupId.HasValue) groupIds.Add(caller.GroupId.Value);

            if (departmentIds.Count == 0 && groupIds.Count == 0 && pairKeys.Count == 0)
                throw new DomainException("Tài khoản của bạn chưa được gán Nhóm/Bộ phận nào.");

            var expandDepartmentIds = departmentIds.Union(callerScopes.Select(x => x.DepartmentId)).ToList();
            if (expandDepartmentIds.Count > 0)
            {
                var childGroups = await _unitOfWork.Groups.SelectAsync(
                    x => !x.IsDeleted && expandDepartmentIds.Contains(x.DepartmentId),
                    x => new { x.Id, x.DepartmentId, x.WorkshopId });
                foreach (var g in childGroups)
                    if (departmentIds.Contains(g.DepartmentId) || pairKeys.Contains(ScopeKey.Of(g.DepartmentId, g.WorkshopId)))
                        groupIds.Add(g.Id);
            }

            return new EmployeeScope(false, departmentIds, groupIds, pairKeys);
        }

        private static IQueryable<Employee> ApplyScope(IQueryable<Employee> query, EmployeeScope scope)
        {
            if (scope.CompanyWide) return query;
            var departmentIds = scope.DepartmentIds;
            var groupIds = scope.GroupIds;
            var pairKeys = scope.PairKeys;
            return query.Where(x =>
                (x.GroupId != null && groupIds.Contains(x.GroupId.Value))
                || (x.DepartmentId != null && departmentIds.Contains(x.DepartmentId.Value))
                || x.ApprovalScopes.Any(s => departmentIds.Contains(s.DepartmentId) || pairKeys.Contains(s.DepartmentId * ScopeKey.Factor + s.WorkshopId)));
        }

        // UX only (filter dropdowns); returns the full department/group lists so FE needs no extra calls.
        public async Task<EmployeeScopeDto> GetMyScopeAsync(string callerUserName, bool isAdmin)
        {
            if (isAdmin) return new EmployeeScopeDto { CompanyWide = true };

            var scope = await ResolveCallerScopeAsync(callerUserName);
            if (scope.CompanyWide) return new EmployeeScopeDto { CompanyWide = true };

            var departmentIdsInScope = scope.DepartmentIds.Union(scope.PairKeys.Select(k => k / ScopeKey.Factor)).ToList();
            var departments = departmentIdsInScope.Count == 0
                ? new List<DepartmentDto>()
                : (await _unitOfWork.Departments.SelectAsync(
                    x => departmentIdsInScope.Contains(x.Id) && !x.IsDeleted,
                    x => new DepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentNameVn = x.DepartmentNameVn, DepartmentNameJp = x.DepartmentNameJp }))
                    .ToList();

            // GroupIds is already expanded to every group under a coordinated department or managed pair.
            var groups = scope.GroupIds.Count == 0
                ? new List<GroupDto>()
                : (await _unitOfWork.Groups.SelectAsync(
                    x => !x.IsDeleted && scope.GroupIds.Contains(x.Id),
                    x => new GroupDto
                    {
                        Id = x.Id,
                        GroupCode = x.GroupCode,
                        GroupNameVn = x.GroupNameVn,
                        GroupNameJp = x.GroupNameJp,
                        DepartmentId = x.DepartmentId,
                        DepartmentNameVn = x.Department.DepartmentNameVn,
                        WorkshopId = x.WorkshopId,
                        WorkshopNameVn = x.Workshop.WorkshopNameVn
                    }))
                    .ToList();

            var workshopIds = groups.Select(g => g.WorkshopId).Union(scope.PairKeys.Select(k => k % ScopeKey.Factor)).ToList();
            var workshops = workshopIds.Count == 0
                ? new List<WorkshopDto>()
                : (await _unitOfWork.Workshops.SelectAsync(
                    x => workshopIds.Contains(x.Id) && !x.IsDeleted,
                    x => new WorkshopDto { Id = x.Id, WorkshopCode = x.WorkshopCode, WorkshopNameVn = x.WorkshopNameVn, WorkshopNameJp = x.WorkshopNameJp }))
                    .OrderBy(x => x.WorkshopCode)
                    .ToList();

            return new EmployeeScopeDto { Departments = departments, Groups = groups, Workshops = workshops };
        }

        // Shared by the grid and the import-dialog exports so both list exactly the same employees.
        private async Task<IQueryable<Employee>> BuildListQueryAsync(string callerUserName, bool isAdmin, EmployeeExportFilterDto filter)
        {
            var keyword = filter.Keyword?.Trim();
            var (departmentId, groupId, workshopId) = (filter.DepartmentId, filter.GroupId, filter.WorkshopId);
            var query = _unitOfWork.Employees.GetQueryable(false, x => x.Group!, x => x.Department!, x => x.JobTitle!).Where(x => !x.IsDeleted);

            if (!isAdmin)
                query = ApplyScope(query, await ResolveCallerScopeAsync(callerUserName));

            // Managers match a department through their approval scopes; workshop managers/directors match none.
            if (departmentId.HasValue)
                query = query.Where(x => x.ApprovalScopes.Any(s => s.DepartmentId == departmentId.Value) || (x.Group != null && x.Group.DepartmentId == departmentId.Value));
            if (workshopId.HasValue)
                query = query.Where(x => x.ApprovalScopes.Any(s => s.WorkshopId == workshopId.Value) || (x.Group != null && x.Group.WorkshopId == workshopId.Value));
            if (groupId.HasValue)
                query = query.Where(x => x.GroupId == groupId.Value);
            if (filter.ProductionLineId.HasValue)
                query = query.Where(x => x.ProductionLineId == filter.ProductionLineId);
            if (filter.TeamId.HasValue)
                query = query.Where(x => x.TeamId == filter.TeamId);
            if (filter.ShiftTeamId.HasValue)
                query = query.Where(x => x.ShiftTeamId == filter.ShiftTeamId);
            if (!string.IsNullOrWhiteSpace(filter.CongDoan))
                query = query.Where(x => x.CongDoan == filter.CongDoan);

            if (!string.IsNullOrWhiteSpace(keyword))
                query = query.Where(x =>
                    x.Code.Contains(keyword) ||
                    x.FirstName.Contains(keyword) ||
                    x.LastName.Contains(keyword) ||
                    (x.LastName + " " + x.FirstName).Contains(keyword));

            return query;
        }

        public async Task<PagedResponse<EmployeeDto>> GetPagedAsync(
            string callerUserName, bool isAdmin, int pageIndex, int pageSize, EmployeeExportFilterDto filter)
        {
            var keyword = filter.Keyword;
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var query = await BuildListQueryAsync(callerUserName, isAdmin, filter);

            // An exact code match goes first instead of being buried among codes that merely contain the keyword.
            var orderedQuery = string.IsNullOrWhiteSpace(keyword)
                ? query.OrderBy(x => x.Code.Length).ThenBy(x => x.Code)
                : query.OrderBy(x => x.Code == keyword ? 0 : 1).ThenBy(x => x.Code.Length).ThenBy(x => x.Code);

            return await _unitOfWork.Employees.ToPagedResponseAsync(
                orderedQuery,
                pageIndex,
                pageSize,
                x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    ProductionLineId = x.ProductionLineId,
                    LineCode = x.ProductionLine != null ? x.ProductionLine.LineCode : null,
                    TeamId = x.TeamId,
                    TeamCode = x.Team != null ? x.Team.Code : null,
                    ShiftTeamId = x.ShiftTeamId,
                    ShiftTeamCode = x.ShiftTeam != null ? x.ShiftTeam.Code : null,
                    CongDoan = x.CongDoan,
                    TaskName = x.TaskName,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Group != null ? x.Group.Department.DepartmentNameVn : x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                }
            );
        }

        public async Task<List<EmployeeExportRowDto>> GetForExportAsync(
            string callerUserName, bool isAdmin, EmployeeExportFilterDto filter, int? year = null, int? month = null)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var y = year ?? todayYear;
            var m = month ?? todayMonth;
            var query = await BuildListQueryAsync(callerUserName, isAdmin, filter);

            return await _unitOfWork.Employees.ToListAsync(
                query.OrderBy(x => x.Code.Length).ThenBy(x => x.Code),
                x => new EmployeeExportRowDto
                {
                    Code = x.Code,
                    FullName = x.LastName + " " + x.FirstName,
                    UserName = x.UserName,
                    DepartmentCode = x.Group != null ? x.Group.Department.DepartmentCode : x.Department != null ? x.Department.DepartmentCode : null,
                    DepartmentNameVn = x.Group != null ? x.Group.Department.DepartmentNameVn : x.Department != null ? x.Department.DepartmentNameVn : null,
                    GroupCode = x.Group != null ? x.Group.GroupCode : null,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    JobTitleCode = x.JobTitle != null ? x.JobTitle.Code : null,
                    TerminalLevel = x.JobTitle != null ? x.JobTitle.TerminalLevel : (int)JobTitleTerminalLevel.None,
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit,
                    MonthHours = x.EmployeeAccumulationHistories.Where(h => h.Year == y && h.Month == m).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearHours = x.EmployeeAccumulationHistories.Where(h => h.Year == y && h.Month <= m).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    LineCode = x.ProductionLine != null ? x.ProductionLine.LineCode : null,
                    TeamCode = x.Team != null ? x.Team.Code : null,
                    ShiftTeamCode = x.ShiftTeam != null ? x.ShiftTeam.Code : null,
                    CongDoan = x.CongDoan,
                    TaskName = x.TaskName
                });
        }

        // Group leaders pick their own group's employees; managers and above have no GroupId and never match.
        // Projected totals use targetDate's month/year (the form's date), not today like MonthToDate/YearToDate.
        public async Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId, DateOnly? targetDate = null)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && x.GroupId == groupId,
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                }
            );

            var target = targetDate ?? DateOnly.FromDateTime(TimeHelper.GetCurrentUtcTime());
            var employeeIds = items.Select(x => x.Id).ToList();
            if (employeeIds.Count > 0)
            {
                var mealSettings = await _attendanceSettingService.GetAsync();

                // Same projection rule as OtFormService.ComputeAccumulatedHoursBatchAsync: Day from every valid form,
                // Month/Year from the ledger plus forms still InApproval (Completed forms are already in the ledger).
                var rows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                    x => employeeIds.Contains(x.EmployeeId) && !x.IsRemoved && x.OtForm.Status != (int)OtFormStatus.Rejected
                         && !x.OtForm.IsDeleted && x.OtForm.Date.Year == target.Year,
                    x => x.OtForm);
                var ledgerRows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                    x => employeeIds.Contains(x.EmployeeId) && x.Year == target.Year);

                var rowsByEmployee = rows.ToLookup(x => x.EmployeeId);
                var ledgerByEmployee = ledgerRows.ToLookup(x => x.EmployeeId);
                foreach (var item in items)
                {
                    var employeeRows = rowsByEmployee[item.Id].ToList();
                    var pendingRows = employeeRows.Where(x => x.OtForm.Status != (int)OtFormStatus.Completed).ToList();
                    var ledger = ledgerByEmployee[item.Id].ToList();

                    item.ProjectedDayToDate = employeeRows.Where(x => x.OtForm.Date == target)
                        .Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings));
                    item.ProjectedMonthToDate = ledger.Where(x => x.Month == target.Month).Sum(x => x.TotalHours)
                        + pendingRows.Where(x => x.OtForm.Date.Month == target.Month).Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings));
                    item.ProjectedYearToDate = ledger.Sum(x => x.TotalHours)
                        + pendingRows.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, mealSettings));
                }
            }

            return items.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).ToList();
        }

        // Includes managers assigned directly by DepartmentId. Always capped since a department can hold thousands;
        // callers narrow with keyword / jobTitledOnly / take.
        private const int MaxDepartmentListSize = 500;

        public async Task<List<EmployeeDto>> GetByDepartmentIdAsync(
            int departmentId, int? workshopId = null, string? keyword = null, bool jobTitledOnly = false, int? take = null)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var trimmedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();
            var limit = Math.Clamp(take ?? MaxDepartmentListSize, 1, MaxDepartmentListSize);

            var query = _unitOfWork.Employees.GetQueryable().Where(x => !x.IsDeleted
                && (x.ApprovalScopes.Any(s => s.DepartmentId == departmentId && (workshopId == null || s.WorkshopId == workshopId))
                    || (x.Group != null && x.Group.DepartmentId == departmentId && (workshopId == null || x.Group.WorkshopId == workshopId))));
            if (jobTitledOnly)
                query = query.Where(x => x.JobTitleId != null);
            if (trimmedKeyword != null)
                query = query.Where(x => x.Code.Contains(trimmedKeyword) || x.LastName.Contains(trimmedKeyword) || x.FirstName.Contains(trimmedKeyword));

            return await _unitOfWork.Employees.ToListAsync(
                query.OrderBy(x => x.Code.Length).ThenBy(x => x.Code).Take(limit),
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                });
        }

        // For approvers who may lack Employee.View; scope follows the caller's real job-title position,
        // not the coordinator list.
        public async Task<PagedResponse<EmployeeDto>> GetInScopeAsync(string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var query = _unitOfWork.Employees.GetQueryable(false, x => x.Group!, x => x.Department!, x => x.JobTitle!).Where(x => !x.IsDeleted);

            if (!isAdmin)
                query = ApplyScope(query, await ResolveCallerScopeAsync(callerUserName));

            var orderedQuery = query.OrderBy(x => x.Code.Length).ThenBy(x => x.Code);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x =>
                    x.Code.Contains(keyword) ||
                    x.FirstName.Contains(keyword) ||
                    x.LastName.Contains(keyword) ||
                    (x.LastName + " " + x.FirstName).Contains(keyword));
                orderedQuery = query.OrderBy(x => x.Code == keyword ? 0 : 1).ThenBy(x => x.Code.Length).ThenBy(x => x.Code);
            }

            return await _unitOfWork.Employees.ToPagedResponseAsync(
                orderedQuery,
                pageIndex,
                pageSize,
                x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month == todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    YearToDate = x.EmployeeAccumulationHistories.Where(h => h.Year == todayYear && h.Month <= todayMonth).Sum(h => (decimal?)h.TotalHours) ?? 0m,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null,
                    JobTitleId = x.JobTitleId,
                    JobTitleName = x.JobTitle != null ? x.JobTitle.Name : null,
                    WorkshopId = x.Group != null ? x.Group.WorkshopId : (int?)null,
                    WorkshopNameVn = x.Group != null ? x.Group.Workshop.WorkshopNameVn : null,
                    ApprovalScopes = x.ApprovalScopes.Select(s => new EmployeeApprovalScopeDto
                    {
                        WorkshopId = s.WorkshopId,
                        WorkshopNameVn = s.Workshop.WorkshopNameVn,
                        DepartmentId = s.DepartmentId,
                        DepartmentNameVn = s.Department.DepartmentNameVn
                    }).ToList(),
                    CustomMonthlyOtHourLimit = x.CustomMonthlyOtHourLimit,
                    CustomYearlyOtHourLimit = x.CustomYearlyOtHourLimit
                }
            );
        }

        // Ledger is append-only and has no data before it was introduced; same scope as GetInScopeAsync.
        public async Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryAsync(string callerUserName, bool isAdmin, int employeeId, int year)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            if (!isAdmin)
                await EnsureInAccumulationScopeAsync(callerUserName, employee!);

            return await BuildAccumulationYearDtoAsync(employee!, year);
        }

        // For accumulation editors (Admin/coordinator); does not require Attendance.OTForm.Approve.
        public async Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryForManageAsync(string callerUserName, bool isAdmin, int employeeId, int year)
        {
            var employee = (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!))
                .OrThrowNotFound("Nhân viên", employeeId);
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee,
                "Bạn chỉ được sửa lũy kế của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");
            return await BuildAccumulationYearDtoAsync(employee, year);
        }

        public async Task<bool> CanViewOverviewAsync(string callerUserName, bool isAdmin)
        {
            if (isAdmin) return true;

            var caller = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == callerUserName && !x.IsDeleted, x => x.JobTitle!);
            return caller?.JobTitle != null && caller.JobTitle.TerminalLevel != (int)JobTitleTerminalLevel.None;
        }

        public async Task<IQueryable<Employee>> GetOverviewEmployeeQueryAsync(string callerUserName, bool isAdmin, int? workshopId)
        {
            var query = _unitOfWork.Employees.GetQueryable().Where(x => !x.IsDeleted);

            if (!isAdmin)
                query = ApplyScope(query, await ResolveCallerScopeAsync(callerUserName));
            if (workshopId.HasValue)
                query = query.Where(x => x.ApprovalScopes.Any(s => s.WorkshopId == workshopId.Value) || (x.Group != null && x.Group.WorkshopId == workshopId.Value));

            return query;
        }

        public async Task<List<EmployeeAccumulationDayDto>> GetAccumulationDaysAsync(string callerUserName, bool isAdmin, int employeeId, int year, int month)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            if (!isAdmin)
                await EnsureInAccumulationScopeAsync(callerUserName, employee!);

            return await BuildAccumulationDaysAsync(employeeId, year, month);
        }

        public async Task<List<EmployeeAccumulationDayDto>> GetAccumulationDaysForManageAsync(string callerUserName, bool isAdmin, int employeeId, int year, int month)
        {
            var employee = (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!))
                .OrThrowNotFound("Nhân viên", employeeId);
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee,
                "Bạn chỉ được xem lũy kế của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");
            return await BuildAccumulationDaysAsync(employeeId, year, month);
        }

        // Same rows and hour formula as the ledger feed (Completed forms), so imported/hand-edited hours have no day.
        private async Task<List<EmployeeAccumulationDayDto>> BuildAccumulationDaysAsync(int employeeId, int year, int month)
        {
            if (month < 1 || month > 12)
                throw new DomainException("Tháng phải từ 1 đến 12.");

            var settings = await _attendanceSettingService.GetAsync();
            var rows = await _unitOfWork.OtFormEmployees.FindWithIncludesAsync(
                x => x.EmployeeId == employeeId && !x.IsRemoved && !x.OtForm.IsDeleted
                     && x.OtForm.Status == (int)OtFormStatus.Completed
                     && x.OtForm.Date.Year == year && x.OtForm.Date.Month == month,
                x => x.OtForm);

            return rows
                .GroupBy(x => x.OtForm.Date)
                .OrderBy(g => g.Key)
                .Select(g => new EmployeeAccumulationDayDto
                {
                    Date = g.Key,
                    Hours = g.Sum(x => MealTicketCalculator.CalculateOtHours(x.StartTime, x.EndTime, x.DidEat, settings))
                })
                .ToList();
        }

        // No reason or audit log by design; zero values don't create missing rows.
        public async Task<EmployeeAccumulationHistoryYearDto> UpdateAccumulationHistoryAsync(
            string callerUserName, bool isAdmin, int employeeId, UpdateEmployeeAccumulationDto request)
        {
            var employee = (await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!))
                .OrThrowNotFound("Nhân viên", employeeId);
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee,
                "Bạn chỉ được sửa lũy kế của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            var hoursByMonth = new Dictionary<int, decimal> { [0] = request.InitialBalanceHours };
            foreach (var m in request.Months)
            {
                if (m.Month < 1 || m.Month > 12)
                    throw new DomainException("Tháng phải từ 1 đến 12.");
                if (m.TotalHours < 0)
                    throw new DomainException("Số giờ không được âm.");
                hoursByMonth[m.Month] = Math.Round(m.TotalHours, 2);
            }
            hoursByMonth[0] = Math.Round(request.InitialBalanceHours, 2);

            var existing = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(x => x.EmployeeId == employeeId && x.Year == request.Year);
            foreach (var (month, hours) in hoursByMonth)
            {
                var row = existing.FirstOrDefault(x => x.Month == month);
                if (row != null)
                {
                    row.TotalHours = hours;
                    _unitOfWork.EmployeeAccumulationHistories.Update(row);
                }
                else if (hours != 0)
                {
                    await _unitOfWork.EmployeeAccumulationHistories.AddAsync(new EmployeeAccumulationHistory
                    {
                        EmployeeId = employeeId,
                        Year = request.Year,
                        Month = month,
                        TotalHours = hours
                    });
                }
            }
            await _unitOfWork.SaveChangesAsync();

            return await BuildAccumulationYearDtoAsync(employee, request.Year);
        }

        // Department coordinators may edit the whole department; group coordinators only their group.
        private async Task EnsureCanManageDeptOrGroupScopeAsync(string callerUserName, bool isAdmin, Employee employee, string errorMessage)
        {
            if (isAdmin) return;

            var departmentId = employee.DepartmentId ?? employee.Group?.DepartmentId;
            if (departmentId.HasValue && (await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName)).Contains(departmentId.Value))
                return;

            if (employee.GroupId.HasValue)
            {
                var groupId = employee.GroupId.Value;
                var isGroupCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                    x => x.GroupId == groupId && x.Employee.UserName == callerUserName && !x.IsDeleted)).Count > 0;
                if (isGroupCoordinator) return;
            }

            throw new DomainException(errorMessage);
        }

        // Variant for Create/Update with an already-resolved (groupId, departmentId); both null means a
        // company-wide title that only Admin may assign.
        private async Task EnsureAssignmentInCallerScopeAsync(
            string callerUserName, bool isAdmin, int? groupId, int? departmentId, List<(int WorkshopId, int DepartmentId)> scopes, string errorMessage)
        {
            if (isAdmin) return;

            // A manager's pairs must all sit inside departments the caller coordinates.
            if (scopes.Count > 0)
            {
                var coordinated = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);
                if (scopes.All(x => coordinated.Contains(x.DepartmentId))) return;
                throw new DomainException(errorMessage);
            }

            if (!groupId.HasValue && !departmentId.HasValue)
                throw new DomainException(errorMessage);

            var managedDepartmentIds = await _departmentAccessGuard.GetManagedDepartmentIdsAsync(callerUserName);

            if (departmentId.HasValue)
            {
                if (managedDepartmentIds.Contains(departmentId.Value)) return;
                throw new DomainException(errorMessage);
            }

            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == groupId!.Value && !x.IsDeleted);
            if (group != null && managedDepartmentIds.Contains(group.DepartmentId)) return;

            var isGroupCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.GroupId == groupId!.Value && x.Employee.UserName == callerUserName && !x.IsDeleted)).Count > 0;
            if (isGroupCoordinator) return;

            throw new DomainException(errorMessage);
        }

        private async Task<EmployeeAccumulationHistoryYearDto> BuildAccumulationYearDtoAsync(Employee employee, int year)
        {
            var employeeId = employee.Id;
            var rows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(x => x.EmployeeId == employeeId && x.Year == year);
            var hoursByMonth = rows.ToDictionary(x => x.Month, x => x.TotalHours);

            var initialBalance = hoursByMonth.GetValueOrDefault(0, 0m);
            var months = new List<EmployeeAccumulationHistoryDto>();
            decimal yearTotal = initialBalance;
            for (var month = 1; month <= 12; month++)
            {
                var hours = hoursByMonth.GetValueOrDefault(month, 0m);
                months.Add(new EmployeeAccumulationHistoryDto { Month = month, TotalHours = hours });
                yearTotal += hours;
            }

            return new EmployeeAccumulationHistoryYearDto
            {
                EmployeeId = employee.Id,
                EmployeeCode = employee.Code,
                EmployeeFullName = $"{employee.LastName} {employee.FirstName}",
                Year = year,
                Months = months,
                InitialBalanceHours = initialBalance,
                YearTotalHours = yearTotal
            };
        }

        // Same rules as GetInScopeAsync, checked directly against one known employee.
        private async Task EnsureInAccumulationScopeAsync(string callerUserName, Employee targetEmployee)
        {
            var caller = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == callerUserName && !x.IsDeleted, x => x.JobTitle!);
            if (caller == null)
                throw new DomainException("Tài khoản của bạn chưa liên kết với hồ sơ Nhân viên nào.");

            var callerTerminalLevel = (JobTitleTerminalLevel)(caller.JobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);
            if (callerTerminalLevel == JobTitleTerminalLevel.WorkshopManager || callerTerminalLevel == JobTitleTerminalLevel.GeneralDirector)
                return;

            var callerScopes = await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == caller.Id);
            if (callerScopes.Count > 0)
            {
                var callerKeys = callerScopes.Select(x => ScopeKey.Of(x.DepartmentId, x.WorkshopId)).ToHashSet();
                var targetKeys = (await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == targetEmployee.Id))
                    .Select(x => ScopeKey.Of(x.DepartmentId, x.WorkshopId)).ToHashSet();
                if (targetEmployee.GroupId.HasValue)
                {
                    var targetGroup = await _unitOfWork.Groups.GetByIdAsync(targetEmployee.GroupId.Value);
                    if (targetGroup != null) targetKeys.Add(ScopeKey.Of(targetGroup.DepartmentId, targetGroup.WorkshopId));
                }
                if (targetKeys.Overlaps(callerKeys)) return;
                throw new DomainException("Bạn chỉ được xem lũy kế của nhân viên thuộc Bộ phận mình quản lý.");
            }

            if (caller.GroupId.HasValue && targetEmployee.GroupId == caller.GroupId) return;

            throw new DomainException("Bạn chỉ được xem lũy kế của nhân viên thuộc Nhóm mình quản lý.");
        }

        private async Task<(decimal MonthToDate, decimal YearToDate)> GetRealAccumulationAsync(int employeeId)
        {
            var (todayYear, todayMonth) = GetTodayYearMonth();
            var rows = await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                x => x.EmployeeId == employeeId && x.Year == todayYear && x.Month <= todayMonth);
            return (rows.Where(x => x.Month == todayMonth).Sum(x => x.TotalHours), rows.Sum(x => x.TotalHours));
        }

        // Single-employee reads load the workshop/scopes separately; list reads project them inline.
        private async Task FillWorkshopInfoAsync(EmployeeDto dto)
        {
            if (dto.GroupId.HasValue)
            {
                var groupId = dto.GroupId.Value;
                var info = (await _unitOfWork.Groups.SelectAsync(x => x.Id == groupId, x => new { x.WorkshopId, x.Workshop.WorkshopNameVn })).FirstOrDefault();
                dto.WorkshopId = info?.WorkshopId;
                dto.WorkshopNameVn = info?.WorkshopNameVn;
            }

            dto.ApprovalScopes = (await _unitOfWork.EmployeeApprovalScopes.SelectAsync(
                x => x.EmployeeId == dto.Id,
                x => new EmployeeApprovalScopeDto
                {
                    WorkshopId = x.WorkshopId,
                    WorkshopNameVn = x.Workshop.WorkshopNameVn,
                    DepartmentId = x.DepartmentId,
                    DepartmentNameVn = x.Department.DepartmentNameVn
                })).ToList();
        }

        public async Task<EmployeeDto> GetByIdAsync(int id)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, x => x.Group!, x => x.Department!, x => x.JobTitle!);
            employee.OrThrowNotFound("Nhân viên", id);

            var (monthToDate, yearToDate) = await GetRealAccumulationAsync(id);

            var dto = new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                UserName = employee.UserName,
                MonthToDate = monthToDate,
                YearToDate = yearToDate,
                GroupId = employee.GroupId,
                GroupNameVn = employee.Group?.GroupNameVn,
                DepartmentId = employee.DepartmentId,
                DepartmentNameVn = employee.Department?.DepartmentNameVn,
                JobTitleId = employee.JobTitleId,
                JobTitleName = employee.JobTitle?.Name,
                CustomMonthlyOtHourLimit = employee.CustomMonthlyOtHourLimit,
                CustomYearlyOtHourLimit = employee.CustomYearlyOtHourLimit
            };
            await FillWorkshopInfoAsync(dto);
            return dto;
        }

        // Matches Employee.UserName so employees can look up their own record.
        public async Task<EmployeeDto> GetByUserNameAsync(string userName)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted, x => x.Group!, x => x.Department!, x => x.JobTitle!);
            employee.OrThrowNotFound("Nhân viên (tài khoản chưa được gán cho nhân viên nào)", userName);

            var (monthToDate, yearToDate) = await GetRealAccumulationAsync(employee!.Id);

            var dto = new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                UserName = employee.UserName,
                MonthToDate = monthToDate,
                YearToDate = yearToDate,
                GroupId = employee.GroupId,
                GroupNameVn = employee.Group?.GroupNameVn,
                DepartmentId = employee.DepartmentId,
                DepartmentNameVn = employee.Department?.DepartmentNameVn,
                JobTitleId = employee.JobTitleId,
                JobTitleName = employee.JobTitle?.Name,
                CustomMonthlyOtHourLimit = employee.CustomMonthlyOtHourLimit,
                CustomYearlyOtHourLimit = employee.CustomYearlyOtHourLimit
            };
            await FillWorkshopInfoAsync(dto);
            return dto;
        }

        public async Task<EmployeeDto> CreateAsync(string callerUserName, bool isAdmin, CreateEmployeeDto request)
        {
            var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhân viên '{request.Code}' đã tồn tại.");

            if (!string.IsNullOrWhiteSpace(request.UserName))
            {
                var existsUserName = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == request.UserName && !x.IsDeleted);
                if (existsUserName != null) throw new DomainException($"Tài khoản '{request.UserName}' đã được gán cho nhân viên khác.");
            }

            var (groupId, departmentId, scopes) = await ValidateOrganizationAssignmentAsync(request.JobTitleId, request.GroupId, request.DepartmentId, request.ApprovalScopes);
            await EnsureAssignmentInCallerScopeAsync(callerUserName, isAdmin, groupId, departmentId, scopes,
                "Bạn chỉ được tạo nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            var newEmployee = new Employee
            {
                Code = request.Code,
                FirstName = request.FirstName,
                LastName = request.LastName,
                UserName = request.UserName,
                GroupId = groupId,
                DepartmentId = departmentId,
                JobTitleId = request.JobTitleId,
                CustomMonthlyOtHourLimit = request.CustomMonthlyOtHourLimit,
                CustomYearlyOtHourLimit = request.CustomYearlyOtHourLimit,
                IsDeleted = false
            };

            await _unitOfWork.Employees.AddAsync(newEmployee);
            await _unitOfWork.SaveChangesAsync();
            await ReplaceApprovalScopesAsync(newEmployee.Id, scopes);

            await SyncAutoGrantedPermissionsCoreAsync(newEmployee);

            return await GetByIdAsync(newEmployee.Id);
        }

        public async Task UpdateAsync(string callerUserName, bool isAdmin, UpdateEmployeeDto request)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == request.Id, x => x.Group!);
            employee.OrThrowNotFound("Nhân viên", request.Id);

            // The employee's current scope must be within the caller's.
            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee!,
                "Bạn chỉ được sửa nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            if (employee!.Code != request.Code)
            {
                var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã nhân viên '{request.Code}' đã tồn tại.");
            }

            if (!string.IsNullOrWhiteSpace(request.UserName) && employee.UserName != request.UserName)
            {
                var existsUserName = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == request.UserName && !x.IsDeleted);
                if (existsUserName != null) throw new DomainException($"Tài khoản '{request.UserName}' đã được gán cho nhân viên khác.");
            }

            var (groupId, departmentId, scopes) = await ValidateOrganizationAssignmentAsync(request.JobTitleId, request.GroupId, request.DepartmentId, request.ApprovalScopes);
            // The new scope must also be within the caller's, so employees can't be moved out.
            await EnsureAssignmentInCallerScopeAsync(callerUserName, isAdmin, groupId, departmentId, scopes,
                "Bạn chỉ được chuyển nhân viên vào đúng Bộ phận/Nhóm mình phụ trách.");

            // Needed to revoke auto-granted permissions from the old account on re-link.
            var oldUserName = employee.UserName;

            employee.Code = request.Code;
            employee.FirstName = request.FirstName;
            employee.LastName = request.LastName;
            employee.UserName = request.UserName;
            employee.GroupId = groupId;
            employee.DepartmentId = departmentId;
            employee.JobTitleId = request.JobTitleId;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();
            await ReplaceApprovalScopesAsync(employee.Id, scopes);

            // Revoke from the old account so it doesn't keep permissions of an employee no longer linked.
            if (!string.IsNullOrWhiteSpace(oldUserName) && oldUserName != employee.UserName)
            {
                await _userDirectoryService.SyncAutoGrantedPermissionsAsync(oldUserName, Array.Empty<string>());
            }
            await SyncAutoGrantedPermissionsCoreAsync(employee);
        }

        // Touches only the two limit fields; scoped like other coordinator edits.
        public async Task<EmployeeDto> UpdateOtLimitAsync(string userName, bool isAdmin, int employeeId, UpdateEmployeeOtLimitDto request)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == employeeId && !x.IsDeleted, x => x.Group!);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            await EnsureCanManageDeptOrGroupScopeAsync(userName, isAdmin, employee!,
                "Bạn chỉ được sửa giới hạn OT của nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            employee!.CustomMonthlyOtHourLimit = request.CustomMonthlyOtHourLimit;
            employee.CustomYearlyOtHourLimit = request.CustomYearlyOtHourLimit;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();

            return await GetByIdAsync(employeeId);
        }

        public async Task DeleteAsync(string callerUserName, bool isAdmin, int id)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == id, x => x.Group!);
            employee.OrThrowNotFound("Nhân viên", id);

            await EnsureCanManageDeptOrGroupScopeAsync(callerUserName, isAdmin, employee!,
                "Bạn chỉ được xoá nhân viên thuộc Bộ phận/Nhóm mình phụ trách.");

            employee!.IsDeleted = true;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();

            // Soft-deleted employees hold no title, so revoke every auto-granted permission.
            await _userDirectoryService.SyncAutoGrantedPermissionsAsync(employee.UserName, Array.Empty<string>());
        }

        // Both sources (job title + coordinator) must go in one call: the sync replaces the user's whole
        // auto-granted set, so separate calls would wipe each other. No-op without a UserName.
        private async Task SyncAutoGrantedPermissionsCoreAsync(Employee employee)
        {
            if (string.IsNullOrWhiteSpace(employee.UserName)) return;

            var jobTitleCodes = employee.JobTitleId.HasValue
                ? (await _unitOfWork.JobTitlePermissions.FindAsync(x => x.JobTitleId == employee.JobTitleId.Value && !x.IsDeleted))
                    .Select(x => x.PermissionCode)
                : Enumerable.Empty<string>();

            var isDeptCoordinator = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                x => x.EmployeeId == employee.Id && !x.IsDeleted)).Count > 0;
            var isGroupCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                x => x.EmployeeId == employee.Id && !x.IsDeleted)).Count > 0;

            var coordinatorCodes = new List<string>();
            if (isDeptCoordinator || isGroupCoordinator)
            {
                coordinatorCodes.AddRange(ApprovalStepCoordinatorPermissions.BaseViewCodes);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeAccumulationUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeUpdateOtLimitCode);
                // Same department/group scope as the per-employee edits.
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeAccumulationImportCode);
                // Full employee profile, like Admin but scoped.
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeCreateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.EmployeeDeleteCode);
            }
            if (isDeptCoordinator)
            {
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.DepartmentUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionUpdateCode);
                // Department coordinators only, not group coordinators.
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeViewCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeUpdateCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeImportCode);
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.ProductionEmployeeExportCode);
            }
            if (isGroupCoordinator)
                coordinatorCodes.Add(ApprovalStepCoordinatorPermissions.GroupUpdateCode);

            var desiredCodes = jobTitleCodes.Union(coordinatorCodes).Distinct().ToList();
            await _userDirectoryService.SyncAutoGrantedPermissionsAsync(employee.UserName, desiredCodes);
        }

        public async Task SyncAutoGrantedPermissionsForEmployeeAsync(int employeeId)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            if (employee == null) return;
            await SyncAutoGrantedPermissionsCoreAsync(employee);
        }

        public async Task<int> ResyncAllCoordinatorPermissionsAsync()
        {
            var deptCoordinatorEmployeeIds = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(x => !x.IsDeleted))
                .Select(x => x.EmployeeId);
            var groupCoordinatorEmployeeIds = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(x => !x.IsDeleted))
                .Select(x => x.EmployeeId);
            var employeeIds = deptCoordinatorEmployeeIds.Union(groupCoordinatorEmployeeIds).ToList();

            foreach (var employeeId in employeeIds)
                await SyncAutoGrantedPermissionsForEmployeeAsync(employeeId);

            return employeeIds.Count;
        }

        public async Task<EmployeeDto> AssignDepartmentJobTitleAsync(string userName, bool isAdmin, int employeeId, int departmentId, int? jobTitleId, int? workshopId = null)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            // Prevents borrowing employees of another department through this endpoint.
            var belongsToDepartment = employee!.DepartmentId == departmentId ||
                (await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == employeeId && x.DepartmentId == departmentId)).Count > 0 ||
                (employee.GroupId.HasValue &&
                    (await _unitOfWork.Groups.GetByIdAsync(employee.GroupId.Value)) is Group g && g.DepartmentId == departmentId);
            if (!belongsToDepartment)
                throw new DomainException("Nhân viên này không thuộc Bộ phận đang thao tác.");

            if (!isAdmin)
            {
                var isCoordinator = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                    x => x.DepartmentId == departmentId && x.Employee.UserName == userName && !x.IsDeleted)).Count > 0;
                if (!isCoordinator)
                    throw new DomainException("Bạn không được phân công phụ trách Bộ phận này.");
            }

            JobTitle? jobTitle = null;
            if (jobTitleId.HasValue)
            {
                jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == jobTitleId.Value && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", jobTitleId.Value);
            }
            var terminalLevel = (JobTitleTerminalLevel)(jobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);

            // Company-wide titles exceed a single department, so only Admin may assign them.
            if (!isAdmin && (terminalLevel == JobTitleTerminalLevel.WorkshopManager || terminalLevel == JobTitleTerminalLevel.GeneralDirector))
                throw new DomainException("Chỉ Admin mới được gán Chức vụ Trưởng Xưởng/Giám đốc.");

            int? nextGroupId = employee.GroupId;
            int? nextDepartmentId = employee.DepartmentId;
            var managerScopes = new List<(int WorkshopId, int DepartmentId)>();

            switch (terminalLevel)
            {
                case JobTitleTerminalLevel.DepartmentManager:
                    nextGroupId = null;
                    nextDepartmentId = employee.DepartmentId ?? departmentId;
                    var scopeWorkshopId = workshopId
                        ?? (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => !x.IsDeleted)).OrThrowNotFound("Xưởng", "mặc định")!.Id;
                    (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.Id == scopeWorkshopId && !x.IsDeleted)).OrThrowNotFound("Xưởng", scopeWorkshopId);
                    var pairs = (await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == employeeId))
                        .Select(x => (x.WorkshopId, x.DepartmentId)).ToList();
                    if (!pairs.Contains((scopeWorkshopId, departmentId))) pairs.Add((scopeWorkshopId, departmentId));
                    managerScopes = pairs;
                    break;
                case JobTitleTerminalLevel.WorkshopManager:
                case JobTitleTerminalLevel.GeneralDirector:
                    nextGroupId = null;
                    nextDepartmentId = null;
                    break;
                default:
                    if (employee.GroupId == null)
                        throw new DomainException("Người này hiện không thuộc Nhóm nào — hãy nhờ Admin sửa qua màn Nhân viên.");
                    break; // Intermediate title or removal keeps the current Group/Department.
            }

            employee.JobTitleId = jobTitleId;
            employee.GroupId = nextGroupId;
            employee.DepartmentId = nextDepartmentId;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();
            await ReplaceApprovalScopesAsync(employee.Id, managerScopes);

            await SyncAutoGrantedPermissionsCoreAsync(employee);

            return await GetByIdAsync(employee.Id);
        }

        public async Task<EmployeeDto> AssignGroupJobTitleAsync(string userName, bool isAdmin, int employeeId, int groupId, int? jobTitleId)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            if (employee!.GroupId != groupId)
                throw new DomainException("Nhân viên này không thuộc Nhóm đang thao tác.");

            if (!isAdmin)
            {
                var isCoordinator = (await _unitOfWork.GroupApprovalStepCoordinators.FindAsync(
                    x => x.GroupId == groupId && x.Employee.UserName == userName && !x.IsDeleted)).Count > 0;
                if (!isCoordinator)
                    throw new DomainException("Bạn không được phân công phụ trách Nhóm này.");
            }

            if (jobTitleId.HasValue)
            {
                var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == jobTitleId.Value && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", jobTitleId.Value);
                if (jobTitle!.TerminalLevel != (int)JobTitleTerminalLevel.None)
                    throw new DomainException("Chỉ được gán Chức vụ cấp trung gian (Staff/Group Leader/Team Leader) ở khối Nhóm.");
            }

            // Intermediate titles don't change the employee's organization.
            employee.JobTitleId = jobTitleId;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();

            await SyncAutoGrantedPermissionsCoreAsync(employee);

            return await GetByIdAsync(employee.Id);
        }

        // None: GroupId required, no DepartmentId; DepartmentManager: DepartmentId required, no GroupId;
        // WorkshopManager/GeneralDirector: neither.
        private async Task<(int? GroupId, int? DepartmentId, List<(int WorkshopId, int DepartmentId)> Scopes)> ValidateOrganizationAssignmentAsync(
            int? jobTitleId, int? groupId, int? departmentId, List<EmployeeApprovalScopeInputDto>? approvalScopes)
        {
            JobTitle? jobTitle = null;
            if (jobTitleId.HasValue)
            {
                jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Id == jobTitleId.Value && !x.IsDeleted);
                jobTitle.OrThrowNotFound("Chức vụ", jobTitleId.Value);
            }

            var terminalLevel = (JobTitleTerminalLevel)(jobTitle?.TerminalLevel ?? (int)JobTitleTerminalLevel.None);
            var noScopes = new List<(int WorkshopId, int DepartmentId)>();

            switch (terminalLevel)
            {
                case JobTitleTerminalLevel.WorkshopManager:
                case JobTitleTerminalLevel.GeneralDirector:
                    if (groupId.HasValue || departmentId.HasValue)
                        throw new DomainException("Trưởng Xưởng/Giám đốc dùng chung toàn công ty — không chọn Bộ phận/Phòng ban.");
                    return (null, null, noScopes);

                case JobTitleTerminalLevel.DepartmentManager:
                    if (groupId.HasValue)
                        throw new DomainException("Trưởng phòng không thuộc Bộ phận cụ thể nào — chỉ chọn Phòng ban.");

                    var pairs = (approvalScopes ?? new List<EmployeeApprovalScopeInputDto>())
                        .Select(x => (x.WorkshopId, x.DepartmentId)).Distinct().ToList();
                    // Payload without pairs (single DepartmentId): the default (first) workshop.
                    if (pairs.Count == 0 && departmentId.HasValue)
                    {
                        var defaultWorkshop = (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => !x.IsDeleted)).OrThrowNotFound("Xưởng", "mặc định");
                        pairs.Add((defaultWorkshop!.Id, departmentId.Value));
                    }
                    if (pairs.Count == 0)
                        throw new DomainException("Trưởng phòng phải chọn ít nhất một cặp Xưởng - Phòng ban quản lý.");

                    foreach (var (workshopId, pairDepartmentId) in pairs)
                    {
                        (await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.Id == workshopId && !x.IsDeleted)).OrThrowNotFound("Xưởng", workshopId);
                        (await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.Id == pairDepartmentId && !x.IsDeleted)).OrThrowNotFound("Phòng ban", pairDepartmentId);
                    }
                    return (null, pairs[0].DepartmentId, pairs);

                default:
                    if (departmentId.HasValue)
                        throw new DomainException("Chỉ Trưởng phòng mới chọn Phòng ban trực tiếp — nhân viên thường chọn Bộ phận.");
                    if (!groupId.HasValue)
                        throw new DomainException("Bộ phận không được để trống.");

                    var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == groupId.Value && !x.IsDeleted);
                    group.OrThrowNotFound("Nhóm", groupId.Value);
                    return (groupId, null, noScopes);
            }
        }

        // Replaces the whole pair set; non-managers pass an empty list, which clears stale pairs.
        private async Task ReplaceApprovalScopesAsync(int employeeId, List<(int WorkshopId, int DepartmentId)> scopes)
        {
            var existing = await _unitOfWork.EmployeeApprovalScopes.FindAsync(x => x.EmployeeId == employeeId);
            if (existing.Count > 0) _unitOfWork.EmployeeApprovalScopes.RemoveRange(existing);
            foreach (var (workshopId, departmentId) in scopes)
                await _unitOfWork.EmployeeApprovalScopes.AddAsync(new EmployeeApprovalScope { EmployeeId = employeeId, WorkshopId = workshopId, DepartmentId = departmentId });
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
