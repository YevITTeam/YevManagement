using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Identity.Api.Controllers
{
    public class PermissionController : BaseController
    {
        private readonly IPermissionService _service;

        public PermissionController(IPermissionService service)
        {
            _service = service;
        }

        [RequirePermission("Identity.Permission.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<PermissionDto>>>> GetAllPermissions()
        {
            var permissions = await _service.GetAllPermissionsAsync();
            return Success(permissions, "Lấy danh sách chức năng thành công!");
        }

        [RequirePermission("Identity.Permission.View")]
        [HttpGet("role/{roleId}")]
        public async Task<ActionResult<ApiResponse<List<PermissionDto>>>> GetRolePermissions(int roleId)
        {
            var permissions = await _service.GetRolePermissionsAsync(roleId);
            return Success(permissions, "Lấy danh sách chức năng của quyền thành công!");
        }

        [RequirePermission("Identity.Role.Update")]
        [HttpPut("role/{roleId}")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateRolePermissions(int roleId, [FromBody] List<int> permissionIds)
        {
            await _service.UpdateRolePermissionsAsync(new UpdateRolePermissionsDto
            {
                RoleId = roleId,
                PermissionIds = permissionIds ?? new List<int>()
            });

            return Success(true, "Cập nhật chức năng cho quyền thành công!");
        }

        [RequirePermission("Identity.Permission.View")]
        [HttpGet("user/{userId}")]
        public async Task<ActionResult<ApiResponse<List<UserPermissionDto>>>> GetUserPermissionOverrides(int userId)
        {
            var overrides = await _service.GetUserPermissionOverridesAsync(userId);
            return Success(overrides, "Lấy danh sách chức năng riêng của người dùng thành công!");
        }

        [RequirePermission("Identity.Permission.View")]
        [HttpGet("user/{userId}/effective")]
        public async Task<ActionResult<ApiResponse<List<PermissionDto>>>> GetEffectivePermissionsForUser(int userId)
        {
            var permissions = await _service.GetEffectivePermissionsForUserAsync(userId);
            return Success(permissions, "Lấy danh sách chức năng hiệu lực của người dùng thành công!");
        }

        [RequirePermission("Identity.User.UpdatePermissions")]
        [HttpPut("user/{userId}")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateUserPermissionOverrides(int userId, [FromBody] UpdateUserPermissionOverridesDto request)
        {
            await _service.UpdateUserPermissionOverridesAsync(new UpdateUserPermissionsDto
            {
                UserId = userId,
                GrantPermissionIds = request?.GrantPermissionIds ?? new List<int>(),
                DenyPermissionIds = request?.DenyPermissionIds ?? new List<int>()
            });

            return Success(true, "Cập nhật chức năng riêng của người dùng thành công!");
        }
    }
}
