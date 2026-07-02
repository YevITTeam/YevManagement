using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Yev.Services.Interfaces;
using Yev.DTOs.Request;
using Yev.DTOs.Auth;

namespace Yev.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IRoleService _roleService;
        private readonly ILogger<AdminController> _logger;

        public AdminController(IAuthService authService, IRoleService roleService, ILogger<AdminController> logger)
        {
            _authService = authService;
            _roleService = roleService;
            _logger = logger;
        }

        // GET: /api/admin/users
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                var users = await _authService.GetAllUsersAsync();
                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách nhân viên.");
                return StatusCode(500, new { message = "Đã xảy ra lỗi máy chủ khi tải danh sách người dùng." });
            }
        }

        // GET: /api/admin/roles
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            try
            {
                var roles = await _authService.GetAllRolesAsync();
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách phân quyền.");
                return StatusCode(500, new { message = "Đã xảy ra lỗi máy chủ khi tải danh sách quyền." });
            }
        }

        // POST: /api/admin/users/roles
        [HttpPost("users/roles")]
        public async Task<IActionResult> UpdateUserRoles([FromBody] UpdateUserRolesDto request)
        {
            if (request == null || request.RoleIds == null)
            {
                return BadRequest(new { message = "Dữ liệu gửi lên không hợp lệ." });
            }

            try
            {
                await _authService.UpdateUserRolesAsync(request);
                return Ok(new { message = "Cập nhật quyền thành công!" });
            }
            catch (InvalidOperationException ex)
            {
                // Bắt các lỗi logic nghiệp vụ
                _logger.LogWarning(ex, "Lỗi nghiệp vụ khi cập nhật quyền: {Message}", ex.Message);
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống khi cập nhật quyền cho user ID: {UserId}", request.UserId);
                return StatusCode(500, new { message = "Không thể cập nhật quyền lúc này. Vui lòng thử lại sau." });
            }
        }

        // POST: /api/admin/roles
        [HttpPost("roles")]
        public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request)
        {
            try
            {
                var role = await _roleService.CreateRoleAsync(request);
                return Ok(role);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Lỗi nghiệp vụ khi tạo quyền mới.");
                return BadRequest(new { message = "Tên quyền đã tồn tại hoặc không hợp lệ." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống khi tạo quyền {RoleName}", request?.RoleName);
                return StatusCode(500, new { message = "Đã xảy ra lỗi máy chủ khi tạo quyền mới." });
            }
        }

        // PUT: /api/admin/roles/5
        [HttpPut("roles/{roleId}")]
        public async Task<IActionResult> UpdateRole(int roleId, [FromBody] CreateRoleRequest request)
        {
            try
            {
                var role = await _roleService.UpdateRoleAsync(roleId, request);
                return Ok(role);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Không tìm thấy quyền cần cập nhật với ID: {RoleId}", roleId);
                return NotFound(new { message = "Không tìm thấy dữ liệu phân quyền cần cập nhật." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống khi cập nhật quyền ID: {RoleId}", roleId);
                return StatusCode(500, new { message = "Đã xảy ra lỗi máy chủ khi cập nhật quyền." });
            }
        }

        // DELETE: /api/admin/roles/5
        [HttpDelete("roles/{roleId}")]
        public async Task<IActionResult> DeleteRole(int roleId)    
        {
            try
            {
                var result = await _roleService.DeleteRoleAsync(roleId);

                if (!result)
                {
                    return NotFound(new { message = "Không tìm thấy quyền cần xóa!" });
                }

                return Ok(new { message = "Xóa quyền thành công!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống khi xóa quyền ID: {RoleId}", roleId);
                return StatusCode(500, new { message = "Đã xảy ra lỗi máy chủ khi xóa quyền." });
            }
        }
    }
}