using Identity.Application.Authentication;
using Identity.Application.Dtos.LoginQrDto;
using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using System.Security.Claims;

namespace Identity.Api.Controllers
{
    public class AuthController : BaseController
    {
        private readonly ITokenService _tokenService;
        private readonly IUserService _service;
        private readonly ILoginQrService _loginQrService;
        private readonly IRoleService _roleService;
        private readonly IClaimsTransformation _claimsTransformation;
        private readonly IActiveDirectoryAuthService _adAuthService;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _webHostEnvironment;

        public AuthController(
            ITokenService tokenService,
            IUserService service,
            ILoginQrService loginQrService,
            IRoleService roleService,
            IClaimsTransformation claimsTransformation,
            IActiveDirectoryAuthService adAuthService,
            IConfiguration configuration,
            IWebHostEnvironment webHostEnvironment)
        {
            _tokenService = tokenService;
            _service = service;
            _loginQrService = loginQrService;
            _roleService = roleService;
            _claimsTransformation = claimsTransformation;
            _adAuthService = adAuthService;
            _configuration = configuration;
            _webHostEnvironment = webHostEnvironment;
        }

        private const string TestLoginPrefix = "TEST\\";

        [Authorize(AuthenticationSchemes = "Negotiate")]
        [HttpPost("windows-login")]
        public ActionResult<ApiResponse<LoginResponseDto>> WindowsLogin()
        {
            if (User.Identity == null || !User.Identity.IsAuthenticated)
            {
                return Fail<LoginResponseDto>("Xác thực Windows thất bại. Vui lòng kiểm tra lại cấu hình hệ thống.");
            }

            return Success(BuildSession(User), "Đăng nhập thành công!");
        }

        // Credentials are validated against AD (never stored), then a minimal principal runs through
        // MyClaimsTransformation to reuse JIT provisioning and role/permission loading.
        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<LoginResponseDto>>> Login([FromBody] LoginRequestDto request)
        {
            // "TEST\" accounts use TestLoginAccount.PasswordHash instead of AD; only in Development.
            if (request.UserName != null && request.UserName.StartsWith(TestLoginPrefix, StringComparison.OrdinalIgnoreCase))
            {
                if (!_webHostEnvironment.IsDevelopment())
                    return Fail<LoginResponseDto>("Đăng nhập TEST chỉ khả dụng ở môi trường Development.");

                var isTestValid = await _service.ValidateTestLoginAsync(request.UserName, request.Password);
                if (!isTestValid)
                    return Fail<LoginResponseDto>("Tên đăng nhập hoặc mật khẩu không đúng.");

                var testSeedPrincipal = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.Name, request.UserName) }));
                var testTransformedPrincipal = await _claimsTransformation.TransformAsync(testSeedPrincipal);

                return Success(BuildSession(testTransformedPrincipal), "Đăng nhập thành công (tài khoản TEST)!");
            }

            var domain = _configuration["ActiveDirectory:Domain"] ?? "YEV";

            bool isValid;
            try
            {
                isValid = _adAuthService.ValidateCredentials(domain, request.UserName, request.Password);
            }
            catch (Exception)
            {
                return Fail<LoginResponseDto>("Không thể kết nối máy chủ xác thực. Vui lòng thử lại sau.");
            }

            if (!isValid)
            {
                return Fail<LoginResponseDto>("Tên đăng nhập hoặc mật khẩu không đúng.");
            }

            var seedPrincipal = new ClaimsPrincipal(new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.Name, $"{domain}\\{request.UserName}") }));
            var transformedPrincipal = await _claimsTransformation.TransformAsync(seedPrincipal);

            return Success(BuildSession(transformedPrincipal), "Đăng nhập thành công!");
        }

        // The QR code maps to a user only through the LoginQrCode table.
        [AllowAnonymous]
        [HttpPost("qr-login")]
        public async Task<ActionResult<ApiResponse<LoginResponseDto>>> QrLogin([FromBody] QrLoginRequestDto request)
        {
            var userName = await _loginQrService.ConsumeAsync(
                request.Code,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                Request.Headers.UserAgent.ToString());

            if (userName == null)
                return Fail<LoginResponseDto>("Mã QR không hợp lệ hoặc đã bị thu hồi.");

            var seedPrincipal = new ClaimsPrincipal(new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.Name, userName) }));
            var transformedPrincipal = await _claimsTransformation.TransformAsync(seedPrincipal);

            return Success(BuildSession(transformedPrincipal), "Đăng nhập bằng QR thành công!");
        }

        // Renews the JWT from the existing Bearer token; avoids another windows-login handshake, which prompts for
        // domain credentials when the browser has no SSO for this origin.
        [Authorize]
        [HttpGet("me")]
        public ActionResult<ApiResponse<LoginResponseDto>> Me()
        {
            return Success(BuildSession(User), "Lấy thông tin phiên đăng nhập thành công!");
        }

        // Reads roles/permissions from the fresh "DbRoles" identity, not the possibly stale JWT copies.
        // Takes an explicit principal so Login() can pass one built after AD validation, outside the auth middleware.
        private LoginResponseDto BuildSession(ClaimsPrincipal principal)
        {
            var dbIdentity = principal.Identities
                .FirstOrDefault(i => i.AuthenticationType == IdentityClaimTypes.DbRolesAuthenticationType);
            var profileClaims = (IEnumerable<Claim>?)dbIdentity?.Claims ?? principal.Claims;

            var username = principal.Identity?.Name ?? string.Empty;
            var fullName = profileClaims.FirstOrDefault(c => c.Type == IdentityClaimTypes.FullName)?.Value ?? username;
            var roles = profileClaims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).Distinct().ToList();
            var permissions = profileClaims.Where(c => c.Type == IdentityClaimTypes.Permission).Select(c => c.Value).Distinct().ToList();
            var deviceName = profileClaims.FirstOrDefault(c => c.Type == IdentityClaimTypes.DeviceName)?.Value;
            var email = profileClaims.FirstOrDefault(c => c.Type == IdentityClaimTypes.Email)?.Value;

            int userId = 0;
            var idClaim = principal.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
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
                Token = _tokenService.GenerateJwtToken(principal)
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

        // Only FullName is editable; UserName and DeviceName are login identity.
        [RequirePermission("Identity.User.UpdateFullName")]
        [HttpPut("update-user-fullname")]
        public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUserFullName([FromBody] UpdateUserFullNameDto request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.FullName))
            {
                return Fail<UserDto>("Họ tên không được để trống.");
            }
            try
            {
                var updatedUser = await _service.UpdateUserFullNameAsync(request);
                return Success(updatedUser, "Cập nhật họ tên thành công!");
            }
            catch (Exception ex)
            {
                return Fail<UserDto>($"Cập nhật họ tên thất bại: {ex.Message}");
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
