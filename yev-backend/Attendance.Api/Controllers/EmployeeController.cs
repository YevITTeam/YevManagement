using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
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

        public EmployeeController(IEmployeeService employeeService)
        {
            _employeeService = employeeService;
        }

        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<EmployeeDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null,
            [FromQuery] int? departmentId = null, [FromQuery] int? groupId = null, [FromQuery] int? workshopId = null)
        {
            var result = await _employeeService.GetPagedAsync(CurrentUserName, User.IsInRole(AdminRole), pageIndex, pageSize, keyword, departmentId, groupId, workshopId);
            return Success(result);
        }

        // Trưởng nhóm dùng liệt kê/chọn hàng loạt nhân viên nhóm mình khi lập OtForm. date = ngày trên
        // đơn đang tạo (FE gửi kèm để lũy kế Dự kiến scope đúng tháng/năm của đơn đó, không phải hôm
        // nay thực tế — xem docs/docs-be/attendance-module.md §Lũy kế Dự kiến); bỏ trống = mặc định
        // hôm nay thực tế.
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("by-group/{groupId}")]
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetByGroup(int groupId, [FromQuery] DateOnly? date = null)
        {
            var result = await _employeeService.GetByGroupIdAsync(groupId, date);
            return Success(result);
        }

        // Dùng cho màn "Cây duyệt Phòng ban" — xem ai đang giữ Chức vụ nào trong Phòng ban để gán nhanh.
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetByDepartment(
            int departmentId, [FromQuery] int? workshopId = null, [FromQuery] string? keyword = null, [FromQuery] bool jobTitled = false, [FromQuery] int? take = null)
        {
            var result = await _employeeService.GetByDepartmentIdAsync(departmentId, workshopId, keyword, jobTitled, take);
            return Success(result);
        }

        // Cho FE thu hẹp dropdown lọc Phòng ban/Nhóm ở màn "Nhân viên" khớp đúng phạm vi GetPaged thật
        // sự trả về — route literal đứng cùng cấp "all"/"in-my-scope", không đụng {id} (2026-09-03).
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

        // Gate bằng OTForm.Approve (KHÔNG phải Employee.View) — người chỉ giữ quyền duyệt không có
        // Employee.View sẽ bị 403 ở mọi action khác trên controller này; đây là cách DUY NHẤT để họ tự
        // liệt kê được nhân viên trong phạm vi mình (Cây chức vụ), phục vụ màn "Lũy kế nhân viên"
        // (2026-08-11d). Route literal "in-my-scope" đứng trước {id} — ASP.NET Core tự ưu tiên segment
        // tường minh hơn param nên không đụng route GetById (đã có tiền lệ tương tự với "all").
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

        // Xem/sửa tay lũy kế — Admin hoặc Người phụ trách Bộ phận/Nhóm (scope kiểm ở service).
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

        // Admin dùng ở màn "Phân quyền duyệt" (UserApprovalScope) để tra userName bất kỳ đang thuộc
        // Group/Department nào trước khi gán scope — gợi ý, không bắt buộc (404 nếu userName đó chưa
        // được gán Employee.UserName, thường gặp với Trưởng phòng/Trưởng xưởng/TGĐ vì họ không nhất
        // thiết có hồ sơ Employee).
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

        // Gán/gỡ Chức vụ CÓ PHẠM VI (2026-08-11c) — dùng chung permission với chính cây duyệt của đơn
        // vị đó (Người phụ trách Cây duyệt đã tự động có quyền này, xem
        // EmployeeService.SyncAutoGrantedPermissionsCoreAsync), KHÔNG cần Attendance.Employee.Update
        // (quyền đó chỉ dành cho sửa hồ sơ đầy đủ qua PUT /{id}, vẫn giữ nguyên chỉ Admin). Service tự
        // kiểm tra non-Admin chỉ thao tác được đúng Bộ phận mình phụ trách.
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

        // Permission RIÊNG, hẹp hơn Attendance.Employee.Update (2026-08-29) — Người phụ trách Bộ phận
        // được tự động cấp quyền này (xem ApprovalStepCoordinatorPermissions.EmployeeUpdateOtLimitCode),
        // nhưng KHÔNG có quyền sửa nhân viên nói chung.
        [RequirePermission("Attendance.Employee.UpdateOtLimit")]
        [HttpPut("{id}/ot-limit")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> UpdateOtLimit(int id, [FromBody] UpdateEmployeeOtLimitDto request)
        {
            var result = await _employeeService.UpdateOtLimitAsync(CurrentUserName, User.IsInRole(AdminRole), id, request);
            return Success(result, "Cập nhật giới hạn OT thành công.");
        }

        // Chạy tay 1 lần mỗi khi ĐỔI LUẬT cấp tự động trong code (SyncAutoGrantedPermissionsCoreAsync) —
        // cơ chế sync chỉ chạy theo sự kiện (gán/gỡ Coordinator...), không tự áp lại cho Coordinator đã
        // gán từ trước khi luật đổi (2026-09-28). Admin-only, cùng permission "quản trị" dùng cho các
        // hành động cấu hình toàn hệ thống khác trong module này.
        [RequirePermission("Attendance.Department.Create")]
        [HttpPost("resync-coordinator-permissions")]
        public async Task<ActionResult<ApiResponse<int>>> ResyncCoordinatorPermissions()
        {
            var count = await _employeeService.ResyncAllCoordinatorPermissionsAsync();
            return Success(count, $"Đã đồng bộ lại quyền tự động cho {count} người phụ trách.");
        }
    }
}
