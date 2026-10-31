using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
using Attendance.Domain.Entities;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeService
    {
        // Non-Admins are limited to their own job-title scope: Employee.View is company-wide, so scoping must happen here.
        Task<PagedResponse<EmployeeDto>> GetPagedAsync(string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword, int? departmentId, int? groupId, int? workshopId);

        // Same employees as the grid for that filter (caller scope applied); hours are for year/month, default today.
        Task<List<EmployeeExportRowDto>> GetForExportAsync(string callerUserName, bool isAdmin, EmployeeExportFilterDto filter, int? year = null, int? month = null);

        // For approvers who may lack Employee.View; scope rules live in EmployeeService.ResolveCallerScopeAsync.
        Task<PagedResponse<EmployeeDto>> GetInScopeAsync(string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword);

        // Same access scope as GetInScopeAsync.
        Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryAsync(string callerUserName, bool isAdmin, int employeeId, int year);

        // Admin or the employee's department/group coordinator; scope is enforced in the service.
        Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryForManageAsync(string callerUserName, bool isAdmin, int employeeId, int year);

        // Overview dashboard: Admin or any title above plain staff (TerminalLevel != None).
        Task<bool> CanViewOverviewAsync(string callerUserName, bool isAdmin);

        // Active employees in the caller's scope (Admin: everyone), optionally limited to one workshop. Not materialized:
        // callers compose it as a subquery so no id list is ever loaded.
        Task<IQueryable<Employee>> GetOverviewEmployeeQueryAsync(string callerUserName, bool isAdmin, int? workshopId);

        // Completed forms only; same scope as the history methods above.
        Task<List<EmployeeAccumulationDayDto>> GetAccumulationDaysAsync(string callerUserName, bool isAdmin, int employeeId, int year, int month);
        Task<List<EmployeeAccumulationDayDto>> GetAccumulationDaysForManageAsync(string callerUserName, bool isAdmin, int employeeId, int year, int month);

        Task<EmployeeAccumulationHistoryYearDto> UpdateAccumulationHistoryAsync(string callerUserName, bool isAdmin, int employeeId, UpdateEmployeeAccumulationDto request);

        // UX only (narrows filter dropdowns); security is enforced in GetPagedAsync.
        Task<EmployeeScopeDto> GetMyScopeAsync(string callerUserName, bool isAdmin);

        // Projected totals use targetDate's month/year, not today.
        Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId, DateOnly? targetDate = null);
        // Used by the department approval tree to see and assign job titles in place.
        Task<List<EmployeeDto>> GetByDepartmentIdAsync(int departmentId, int? workshopId = null, string? keyword = null, bool jobTitledOnly = false, int? take = null);
        Task<EmployeeDto> GetByIdAsync(int id);
        Task<EmployeeDto> GetByUserNameAsync(string userName);
        // Coordinators act like Admin within their own department/group only; an update may not move an employee
        // outside the caller's scope.
        Task<EmployeeDto> CreateAsync(string callerUserName, bool isAdmin, CreateEmployeeDto request);
        Task UpdateAsync(string callerUserName, bool isAdmin, UpdateEmployeeDto request);
        Task DeleteAsync(string callerUserName, bool isAdmin, int id);

        // Called whenever coordinators change so permissions apply immediately; no-op until the employee has a UserName.
        Task SyncAutoGrantedPermissionsForEmployeeAsync(int employeeId);

        // Needed after changing grant rules in code, since sync otherwise only runs on events (assign, link, ...).
        Task<int> ResyncAllCoordinatorPermissionsAsync();

        // Coordinators may only assign within their own department/group and never Factory Manager/Director.
        // Group/Department are derived from the new title's TerminalLevel server-side; the client is not trusted.
        Task<EmployeeDto> AssignDepartmentJobTitleAsync(string userName, bool isAdmin, int employeeId, int departmentId, int? jobTitleId, int? workshopId = null);
        Task<EmployeeDto> AssignGroupJobTitleAsync(string userName, bool isAdmin, int employeeId, int groupId, int? jobTitleId);

        // Narrow permission Attendance.Employee.UpdateOtLimit; non-Admins are limited to departments they coordinate.
        Task<EmployeeDto> UpdateOtLimitAsync(string userName, bool isAdmin, int employeeId, UpdateEmployeeOtLimitDto request);
    }
}
