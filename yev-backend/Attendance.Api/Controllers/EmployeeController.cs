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
            [FromQuery] int? departmentId = null, [FromQuery] int? groupId = null)
        {
            var result = await _employeeService.GetPagedAsync(pageIndex, pageSize, keyword, departmentId, groupId);
            return Success(result);
        }

        // Toàn bộ nhân viên active (mọi Group) — dùng cho dropdown/công cụ cần chọn 1 nhân viên bất kỳ
        // (vd JobTitle "Thử chuỗi duyệt", xem docs/docs-be/attendance-module.md §Cây chức vụ).
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetAllActive()
        {
            var result = await _employeeService.GetAllActiveAsync();
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
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetByDepartment(int departmentId)
        {
            var result = await _employeeService.GetByDepartmentIdAsync(departmentId);
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
            var result = await _employeeService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhân viên thành công.");
        }

        [RequirePermission("Attendance.Employee.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateEmployeeDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _employeeService.UpdateAsync(request);
            return Success(true, "Cập nhật nhân viên thành công.");
        }

        [RequirePermission("Attendance.Employee.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _employeeService.DeleteAsync(id);
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
            var result = await _employeeService.AssignDepartmentJobTitleAsync(CurrentUserName, User.IsInRole(AdminRole), id, departmentId, request.JobTitleId);
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
    }
}
