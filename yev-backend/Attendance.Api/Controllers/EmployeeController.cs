using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class EmployeeController : BaseController
    {
        private const string AdminRole = "Admin";
        private readonly IEmployeeService _employeeService;
        private readonly IProductionEmployeeService _productionEmployeeService;

        public EmployeeController(IEmployeeService employeeService, IProductionEmployeeService productionEmployeeService)
        {
            _employeeService = employeeService;
            _productionEmployeeService = productionEmployeeService;
        }

        [RequirePermission("Attendance.Employee.View", "Attendance.ProductionEmployee.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<EmployeeDto>>>> GetPaged(
            [FromQuery] EmployeeExportFilterDto filter, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _employeeService.GetPagedAsync(CurrentUserName, User.IsInRole(AdminRole), pageIndex, pageSize, filter);
            return Success(result);
        }

        // Quick single-person edit between imports.
        [RequirePermission("Attendance.ProductionEmployee.Update")]
        [HttpPut("{id}/production-info")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateProductionInfo(int id, [FromBody] UpdateProductionEmployeeDto request)
        {
            await _productionEmployeeService.UpdateAsync(id, request, CurrentUserName, User.IsInRole(AdminRole));
            return Success(true, "Cập nhật thông tin dưới chuyền thành công.");
        }

        // date = the form's date so projected accumulation uses that month/year; defaults to today.
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("by-group/{groupId}")]
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetByGroup(int groupId, [FromQuery] DateOnly? date = null)
        {
            var result = await _employeeService.GetByGroupIdAsync(groupId, date);
            return Success(result);
        }

        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetByDepartment(
            int departmentId, [FromQuery] int? workshopId = null, [FromQuery] string? keyword = null, [FromQuery] bool jobTitled = false, [FromQuery] int? take = null)
        {
            var result = await _employeeService.GetByDepartmentIdAsync(departmentId, workshopId, keyword, jobTitled, take);
            return Success(result);
        }

        // Lets the FE narrow Department/Group filter dropdowns to what GetPaged actually returns.
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("my-scope")]
        public async Task<ActionResult<ApiResponse<EmployeeScopeDto>>> GetMyScope()
        {
            var result = await _employeeService.GetMyScopeAsync(CurrentUserName, User.IsInRole(AdminRole));
            return Success(result);
        }

        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> GetById(int id)
        {
            var result = await _employeeService.GetByIdAsync(id);
            return Success(result);
        }

        // Gated by OTForm.Approve so approvers without Employee.View can list employees in their scope.
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("in-my-scope")]
        public async Task<ActionResult<ApiResponse<PagedResponse<EmployeeDto>>>> GetInMyScope(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _employeeService.GetInScopeAsync(CurrentUserName, User.IsInRole(AdminRole), pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("{id}/accumulation-history")]
        public async Task<ActionResult<ApiResponse<EmployeeAccumulationHistoryYearDto>>> GetAccumulationHistory(int id, [FromQuery] int year)
        {
            var result = await _employeeService.GetAccumulationHistoryAsync(CurrentUserName, User.IsInRole(AdminRole), id, year);
            return Success(result);
        }

        // Admin or Department/Group coordinators; scope is checked in the service.
        [RequirePermission("Attendance.EmployeeAccumulation.Update")]
        [HttpGet("{id}/accumulation-history/manage")]
        public async Task<ActionResult<ApiResponse<EmployeeAccumulationHistoryYearDto>>> GetAccumulationHistoryForManage(int id, [FromQuery] int year)
        {
            var result = await _employeeService.GetAccumulationHistoryForManageAsync(CurrentUserName, User.IsInRole(AdminRole), id, year);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("{id}/accumulation-history/days")]
        public async Task<ActionResult<ApiResponse<List<EmployeeAccumulationDayDto>>>> GetAccumulationDays(int id, [FromQuery] int year, [FromQuery] int month)
        {
            var result = await _employeeService.GetAccumulationDaysAsync(CurrentUserName, User.IsInRole(AdminRole), id, year, month);
            return Success(result);
        }

        [RequirePermission("Attendance.EmployeeAccumulation.Update")]
        [HttpGet("{id}/accumulation-history/days/manage")]
        public async Task<ActionResult<ApiResponse<List<EmployeeAccumulationDayDto>>>> GetAccumulationDaysForManage(int id, [FromQuery] int year, [FromQuery] int month)
        {
            var result = await _employeeService.GetAccumulationDaysForManageAsync(CurrentUserName, User.IsInRole(AdminRole), id, year, month);
            return Success(result);
        }

        [RequirePermission("Attendance.EmployeeAccumulation.Update")]
        [HttpPut("{id}/accumulation-history")]
        public async Task<ActionResult<ApiResponse<EmployeeAccumulationHistoryYearDto>>> UpdateAccumulationHistory(int id, [FromBody] UpdateEmployeeAccumulationDto request)
        {
            var result = await _employeeService.UpdateAccumulationHistoryAsync(CurrentUserName, User.IsInRole(AdminRole), id, request);
            return Success(result, "Cập nhật lũy kế thành công.");
        }

        // Optional lookup; 404 is common for managers who have no Employee profile.
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("by-username/{userName}")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> GetByUserName(string userName)
        {
            var result = await _employeeService.GetByUserNameAsync(userName);
            return Success(result);
        }

        [RequirePermission("Attendance.Employee.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateEmployeeDto request)
        {
            var result = await _employeeService.CreateAsync(CurrentUserName, User.IsInRole(AdminRole), request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhân viên thành công.");
        }

        [RequirePermission("Attendance.Employee.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateEmployeeDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _employeeService.UpdateAsync(CurrentUserName, User.IsInRole(AdminRole), request);
            return Success(true, "Cập nhật nhân viên thành công.");
        }

        [RequirePermission("Attendance.Employee.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _employeeService.DeleteAsync(CurrentUserName, User.IsInRole(AdminRole), id);
            return Success(true, "Xóa nhân viên thành công.");
        }

        // Scoped assignment reuses the approval-tree permission so coordinators don't need Employee.Update (Admin-only);
        // the service limits non-Admins to their own Department.
        [RequirePermission("Attendance.DepartmentApprovalStep.Update")]
        [HttpPut("{id}/department-job-title")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> AssignDepartmentJobTitle(
            int id, [FromQuery] int departmentId, [FromBody] AssignEmployeeJobTitleDto request)
        {
            var result = await _employeeService.AssignDepartmentJobTitleAsync(CurrentUserName, User.IsInRole(AdminRole), id, departmentId, request.JobTitleId, request.WorkshopId);
            return Success(result, "Cập nhật chức vụ thành công.");
        }

        [RequirePermission("Attendance.GroupApprovalStep.Update")]
        [HttpPut("{id}/group-job-title")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> AssignGroupJobTitle(
            int id, [FromQuery] int groupId, [FromBody] AssignEmployeeJobTitleDto request)
        {
            var result = await _employeeService.AssignGroupJobTitleAsync(CurrentUserName, User.IsInRole(AdminRole), id, groupId, request.JobTitleId);
            return Success(result, "Cập nhật chức vụ thành công.");
        }

        // Narrower than Employee.Update: auto-granted to Department coordinators without general edit rights.
        [RequirePermission("Attendance.Employee.UpdateOtLimit")]
        [HttpPut("{id}/ot-limit")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> UpdateOtLimit(int id, [FromBody] UpdateEmployeeOtLimitDto request)
        {
            var result = await _employeeService.UpdateOtLimitAsync(CurrentUserName, User.IsInRole(AdminRole), id, request);
            return Success(result, "Cập nhật giới hạn OT thành công.");
        }

        // Auto-grant sync is event-driven, so run this once after changing the grant rules to reapply them to existing coordinators.
        [RequirePermission("Attendance.Department.Create")]
        [HttpPost("resync-coordinator-permissions")]
        public async Task<ActionResult<ApiResponse<int>>> ResyncCoordinatorPermissions()
        {
            var count = await _employeeService.ResyncAllCoordinatorPermissionsAsync();
            return Success(count, $"Đã đồng bộ lại quyền tự động cho {count} người phụ trách.");
        }
    }
}
