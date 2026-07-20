using Attendance.Application.Dtos.Employees;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class EmployeeController : BaseController
    {
        private readonly IEmployeeService _employeeService;

        public EmployeeController(IEmployeeService employeeService)
        {
            _employeeService = employeeService;
        }

        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<EmployeeDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _employeeService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        // Trưởng nhóm dùng liệt kê/chọn hàng loạt nhân viên nhóm mình khi lập OtForm.
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("by-group/{groupId}")]
        public async Task<ActionResult<ApiResponse<List<EmployeeDto>>>> GetByGroup(int groupId)
        {
            var result = await _employeeService.GetByGroupIdAsync(groupId);
            return Success(result);
        }

        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> GetById(int id)
        {
            var result = await _employeeService.GetByIdAsync(id);
            return Success(result);
        }

        // Không gắn [RequirePermission] — chỉ cần đăng nhập. Nhân viên tự tra employeeId của chính
        // mình (màn "Lũy kế của tôi") qua Employee.UserName khớp CurrentUserName. 404 nếu tài khoản
        // đang đăng nhập chưa được Admin gán cho nhân viên nào (Employee.UserName vẫn null).
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> GetMe()
        {
            var result = await _employeeService.GetByUserNameAsync(CurrentUserName);
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

        // Không gắn [RequirePermission] — chỉ cần đăng nhập (FallbackPolicy). Cho phép chính nhân
        // viên (Employee.UserName khớp CurrentUserName) tự chỉnh lũy kế của mình, vì không phải ai
        // cũng làm đúng giờ OT đã đăng ký trong form. Người có quyền Attendance.Employee.Update
        // (Admin) chỉnh được cho bất kỳ nhân viên nào.
        [HttpPatch("{id}/adjust-accumulation")]
        public async Task<ActionResult<ApiResponse<bool>>> AdjustAccumulation(int id, [FromBody] AdjustEmployeeAccumulationDto request)
        {
            var canAdjustAny = User.HasClaim("Permission", "Attendance.Employee.Update");
            await _employeeService.AdjustAccumulationAsync(id, CurrentUserName, canAdjustAny, request);
            return Success(true, "Cập nhật lũy kế thành công.");
        }
    }
}
