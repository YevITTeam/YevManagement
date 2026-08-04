using Identity.Application.Authentication;
using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
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

            return Success(BuildSession(), "Đăng nhập thành công!");
        }

        // Re-reads the current profile/permissions and renews the JWT using the Bearer token the caller
        // already has — no Negotiate handshake involved. The frontend calls this on every page load when
        // a token is already stored, instead of hitting windows-login again: each windows-login call is
        // one more NTLM/Kerberos handshake, and on a machine where the browser has no SSO configured for
        // this origin that handshake is a domain credential prompt — the reason users kept being asked to
        // sign in again although they had just signed in successfully.
        // Permissions stay fresh because MyClaimsTransformation reloads Role/Permission from the DB on
        // every authenticated request, Bearer requests included.
        [Authorize]
        [HttpGet("me")]
        public ActionResult<ApiResponse<LoginResponseDto>> Me()
        {
            return Success(BuildSession(), "Lấy thông tin phiên đăng nhập thành công!");
        }

        // Builds the profile + JWT from the principal of the current request. Role/Permission/FullName…
        // are read from the "DbRoles" identity that MyClaimsTransformation just loaded from the DB in
        // THIS request; the copies carried inside an incoming JWT are only the snapshot taken at login
        // time and may already be stale (e.g. a permission revoked in the meantime).
        private LoginResponseDto BuildSession()
        {
            var dbIdentity = User.Identities
                .FirstOrDefault(i => i.AuthenticationType == IdentityClaimTypes.DbRolesAuthenticationType);
            var profileClaims = (IEnumerable<Claim>?)dbIdentity?.Claims ?? User.Claims;

            var username = User.Identity?.Name ?? string.Empty;
            var fullName = profileClaims.FirstOrDefault(c => c.Type == IdentityClaimTypes.FullName)?.Value ?? username;
            var roles = profileClaims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).Distinct().ToList();
            var permissions = profileClaims.Where(c => c.Type == IdentityClaimTypes.Permission).Select(c => c.Value).Distinct().ToList();
            var deviceName = profileClaims.FirstOrDefault(c => c.Type == IdentityClaimTypes.DeviceName)?.Value;
            var email = profileClaims.FirstOrDefault(c => c.Type == IdentityClaimTypes.Email)?.Value;

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
                Permissions = permissions,
                DeviceName = deviceName,
                Email = email
            };

            return new LoginResponseDto
            {
                User = userProfile,
                Token = _tokenService.GenerateJwtToken(User)
            };
        }

        [RequirePermission("Identity.User.View")]
        [HttpGet("get-all-users-with-roles")]
        public async Task<ActionResult<ApiResponse<List<UserDto>>>> GetAllUsersWithRoles([FromQuery] int? roleId)
        {
            var users = await _service.GetAllUsersAsync(roleId);
            return Success(users, "Lấy danh sách người dùng và quyền thành công!");
        }

        [RequirePermission("Identity.User.Create")]
        [HttpPost("create-user")]
        public async Task<ActionResult<ApiResponse<UserDto>>> CreateUser([FromBody] CreateUserDto request)
        {
            try
            {
                var createdUser = await _service.CreateUserAsync(request);
                return Success(createdUser, "Tạo người dùng thành công!");
            }
            catch (Exception ex)
            {
                return Fail<UserDto>($"Tạo người dùng thất bại: {ex.Message}");
            }
        }

        [RequirePermission("Identity.User.Delete")]
        [HttpDelete("delete-user/{userId}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteUser(int userId)
        {
            await _service.DeleteUserAsync(userId);
            return Success(true, "Xóa người dùng thành công!");
        }

        [RequirePermission("Identity.User.UpdateRoles")]
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

        [RequirePermission("Identity.Role.View")]
        [HttpGet("get-all-roles")]
        public async Task<ActionResult<ApiResponse<List<RoleDto>>>> GetAllRoles()
        {
            var roles = await _roleService.GetAllRolesAsync();
            return Success(roles, "Lấy danh sách quyền thành công!");
        }

        [RequirePermission("Identity.Role.Create")]
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

        [RequirePermission("Identity.Role.Update")]
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

        [RequirePermission("Identity.Role.Delete")]
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
