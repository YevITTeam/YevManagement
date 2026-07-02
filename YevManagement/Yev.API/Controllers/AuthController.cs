using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using  Yev.DTOs.Auth;

namespace Yev.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bắt buộc phải có tài khoản Windows/SSO
    public class AuthController : ControllerBase
    {
        [HttpGet("me")]
        public IActionResult GetMe()
        {
            // Trích xuất thông tin từ Claims (Thẻ phụ dbIdentity) mà MyClaimsTransformation đã nạp
            var fullName = User.Claims.FirstOrDefault(c => c.Type == "FullName")?.Value ?? User.Identity?.Name;
            var username = User.Identity?.Name;

            // Lấy ra danh sách toàn bộ các quyền
            var roles = User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList();

            // Đóng gói vào DTO và trả về JSON cho Next.js
            var ipAddress = User.Claims.FirstOrDefault(c => c.Type == "IpAddress")?.Value;
            var deviceName = User.Claims.FirstOrDefault(c => c.Type == "DeviceName")?.Value;

            var userProfile = new UserDto
            {
                Id = 0,
                UserName = username,
                FullName = fullName,
                Roles = roles,
                IpAddress = ipAddress,
                DeviceName = deviceName
            };

            return Ok(userProfile);
        }
    }
}
