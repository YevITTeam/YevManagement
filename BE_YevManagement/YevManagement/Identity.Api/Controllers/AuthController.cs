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

        public AuthController(ITokenService tokenService)
        {
            _tokenService = tokenService;
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
    }
}
