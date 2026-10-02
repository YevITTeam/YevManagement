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

        // Prefix bắt buộc của mọi UserName trong TestLoginAccount — xem
        // Identity.Domain.Entities.TestLoginAccount.
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

        // Đăng nhập bằng form username/password tự viết (không phải popup Negotiate của trình duyệt),
        // dùng cho trang /login tuỳ biến ở FE. Vẫn xác thực bằng Windows Authentication thật sự — bind
        // thẳng vào AD qua PrincipalContext.ValidateCredentials, không lưu password ở đâu cả. Sau khi
        // AD xác nhận đúng, dựng 1 ClaimsPrincipal "mồi" chỉ có Name rồi chạy qua đúng
        // MyClaimsTransformation (IClaimsTransformation) mà windows-login/me đang dùng, để tái sử dụng
        // nguyên vẹn logic JIT-provisioning + gộp Role/Permission thay vì viết lại.
        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<LoginResponseDto>>> Login([FromBody] LoginRequestDto request)
        {
            // Đăng nhập TEST (2026-08-28, theo yêu cầu người dùng — phục vụ test nhanh Cây duyệt Chuyền
            // khi nhân viên thật chưa có tài khoản AD): UserName bắt đầu bằng "TEST\" → xác thực bằng
            // TestLoginAccount.PasswordHash, KHÔNG gọi AD. Chỉ hoạt động khi Development — tự động vô
            // hiệu hoá đường bypass này nếu server chạy môi trường khác (khớp cách /scalar/v1 hiện có).
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

        // Logs in with the code scanned from a printed QR (YEV Scan mobile app). The code only maps to a
        // user through the LoginQrCode table; the session is then built through the same
        // MyClaimsTransformation path as the other login endpoints.
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
            return Success(BuildSession(User), "Lấy thông tin phiên đăng nhập thành công!");
        }

        // Builds the profile + JWT from the given principal. Role/Permission/FullName… are read from the
        // "DbRoles" identity that MyClaimsTransformation just loaded from the DB for THIS principal; the
        // copies carried inside an incoming JWT are only the snapshot taken at login time and may already
        // be stale (e.g. a permission revoked in the meantime).
        // Takes an explicit principal (not just controller's `User`) so Login() above can build a session
        // from a principal it assembled itself after validating credentials against AD, without having
        // gone through the ASP.NET Core authentication middleware.
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

        // Admin edits ONLY the display name (FullName). UserName (Windows login identity) and DeviceName
        // are not editable here — see UserService.UpdateUserFullNameAsync.
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
