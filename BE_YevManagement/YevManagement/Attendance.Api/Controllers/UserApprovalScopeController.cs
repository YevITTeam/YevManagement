using Attendance.Application.Dtos.UserApprovalScopes;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Admin dùng để khai báo Trưởng phòng/Trưởng xưởng phụ trách duyệt Group/Department nào
    // (xem docs/attendance-module.md — cơ chế phân quyền Trưởng phòng).
    public class UserApprovalScopeController : BaseController
    {
        private readonly IUserApprovalScopeService _userApprovalScopeService;

        public UserApprovalScopeController(IUserApprovalScopeService userApprovalScopeService)
        {
            _userApprovalScopeService = userApprovalScopeService;
        }

        [RequirePermission("Attendance.UserApprovalScope.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UserApprovalScopeDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _userApprovalScopeService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.UserApprovalScope.View")]
        [HttpGet("by-user/{userName}")]
        public async Task<ActionResult<ApiResponse<List<UserApprovalScopeDto>>>> GetByUser(string userName)
        {
            var result = await _userApprovalScopeService.GetByUserNameAsync(userName);
            return Success(result);
        }

        [RequirePermission("Attendance.UserApprovalScope.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUserApprovalScopeDto request)
        {
            var result = await _userApprovalScopeService.CreateAsync(request);
            return CreatedSuccess(nameof(GetByUser), new { userName = result.UserName }, result, "Gán phạm vi duyệt thành công.");
        }

        [RequirePermission("Attendance.UserApprovalScope.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _userApprovalScopeService.DeleteAsync(id);
            return Success(true, "Xóa phạm vi duyệt thành công.");
        }
    }
}
