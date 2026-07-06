using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;
using System.Security.Claims;

namespace Identity.Api.Controllers
{
    public class AuthController : BaseController
    {
        private readonly ITokenService _tokenService;
        private readonly IUserService _service;
        private readonly IRoleService _roleService;

        public AuthController(ITokenService tokenService, IUserService service, IRoleService roleService)
        {
            _tokenService = tokenService;
            _service = service;
            _roleService = roleService;
        }

        [Authorize(AuthenticationSchemes = "Negotiate")]
        [HttpPost("windows-login")]
        public ActionResult<ApiResponse<LoginResponseDto>> WindowsLogin()
        {
            if (User.Identity == null || !User.Identity.IsAuthenticated)
            {
                return Fail<LoginResponseDto>("Xác thực Windows thất bại. Vui lòng kiểm tra lại cấu hình hệ thống.");
            }

            var fullName = User.Claims.FirstOrDefault(c => c.Type == "FullName")?.Value ?? User.Identity.Name;
            var username = User.Identity.Name;
            var roles = User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList();
            var deviceName = User.Claims.FirstOrDefault(c => c.Type == "DeviceName")?.Value;

            int userId = 0;
            var idClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (idClaim != null && int.TryParse(idClaim.Value, out int parsedId))
            {
                userId = parsedId;
            }

            var userProfile = new UserDto
            {
                Id = userId,
                UserName = username,
                FullName = fullName,
                Roles = roles,
                DeviceName = deviceName
            };

            var token = _tokenService.GenerateJwtToken(User);

            var responseData = new LoginResponseDto
            {
                User = userProfile,
                Token = token
            };

            return Success(responseData, "Đăng nhập thành công!");
        }

        [Authorize(Roles ="Admin")]
        [HttpGet("get-all-users-with-roles")]
        public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAllUsersWithRoles()
        {
            var users = await _service.GetAllUsersAsync();
            return Success(users, "Lấy danh sách người dùng và quyền thành công!");
        }

        [Authorize(Roles ="Admin")]
        [HttpPost("update-user-roles")]
        public async Task<ActionResult<ApiResponse<string>>> UpdateUserRoles([FromBody] UpdateUserRolesDto request)
        {
            if (request == null || request.RoleIds == null)
            {
                return Fail<string>("Dữ liệu cấp quyền không hợp lệ.");
            }
            try
            {
                await _service.UpdateUserRolesAsync(request);
                return Success("Cập nhật quyền người dùng thành công!");
            }
            catch (Exception ex)
            {
                return Fail<string>($"Cập nhật quyền người dùng thất bại: {ex.Message}");
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("get-all-roles")]
        public async Task<ActionResult<ApiResponse<List<RoleDto>>>> GetAllRoles()
        {
            var roles = await _roleService.GetAllRolesAsync();
            return Success(roles, "Lấy danh sách quyền thành công!");
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("create-role")]
        public async Task<ActionResult<ApiResponse<RoleDto>>> CreateRole([FromBody] RoleDto roleDto)
        {
            if (roleDto == null || string.IsNullOrWhiteSpace(roleDto.RoleName))
            {
                return Fail<RoleDto>("Dữ liệu tạo quyền không hợp lệ.");
            }
            try
            {
                var createdRole = await _roleService.CreateRoleAsync(roleDto);
                return Success(createdRole, "Tạo quyền thành công!");
            }
            catch (Exception ex)
            {
                return Fail<RoleDto>($"Tạo quyền thất bại: {ex.Message}");
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("update-role/{roleId}")]
        public async Task<ActionResult<ApiResponse<bool>>> UpdateRole(int roleId, [FromBody] UpdateRoleDto roleDto)
        {
            if (roleDto == null || string.IsNullOrWhiteSpace(roleDto.RoleName))
            {
                return Fail<bool>("Dữ liệu cập nhật quyền không hợp lệ.");
            }
            try
            {
                var result = await _roleService.UpdateRoleByIdAsync(roleId, roleDto);
                if (result)
                {
                    return Success(true, "Cập nhật quyền thành công!");
                }
                else
                {
                    return Fail<bool>("Không tìm thấy quyền để cập nhật.");
                }
            }
            catch (Exception ex)
            {
                return Fail<bool>($"Cập nhật quyền thất bại: {ex.Message}");
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("delete-role/{roleId}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteRole(int roleId)
        {
            try
            {
                var result = await _roleService.DeleteRoleByIdAsync(roleId);
                if (result)
                {
                    return Success(true, "Xóa quyền thành công!");
                }
                else
                {
                    return Fail<bool>("Không tìm thấy quyền để xóa.");
                }
            }
            catch (Exception ex)
            {
                return Fail<bool>($"Xóa quyền thất bại: {ex.Message}");
            }
        }
    }
}
