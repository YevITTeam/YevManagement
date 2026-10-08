using Identity.Application.Authentication;
using Identity.Application.Dtos.LoginQrDto;
using Identity.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Identity.Api.Controllers
{
    // Admin side of QR login: issue / revoke the printable code of a user and read its audit log.
    // The scan side (POST api/Auth/qr-login) lives in AuthController.
    [RequirePermission("Identity.LoginQr.Manage")]
    public class LoginQrController : BaseController
    {
        private const int LogPageSize = 50;

        private readonly ILoginQrService _service;

        public LoginQrController(ILoginQrService service)
        {
            _service = service;
        }

        // Users that currently have an active code.
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<LoginQrStatusDto>>>> GetActive()
        {
            var data = await _service.GetActiveAsync();
            return Success(data, "Lấy danh sách mã QR đăng nhập thành công!");
        }

        // Issues a new code for the user and revokes the previous one. The raw code is only in this response.
        [HttpPost("{userId:int}")]
        public async Task<ActionResult<ApiResponse<LoginQrGeneratedDto>>> Generate(int userId)
        {
            var data = await _service.GenerateAsync(userId, GetCurrentUserId(), GetClientIp());
            return Success(data, "Tạo mã QR đăng nhập thành công!");
        }

        // Issues new codes for several users at once (bulk label printing); each user's previous code is revoked.
        [HttpPost("batch")]
        public async Task<ActionResult<ApiResponse<List<LoginQrGeneratedDto>>>> GenerateBatch([FromBody] LoginQrBatchRequestDto request)
        {
            var data = await _service.GenerateBatchAsync(request.UserIds, GetCurrentUserId(), GetClientIp());
            return Success(data, "Tạo mã QR đăng nhập hàng loạt thành công!");
        }

        [HttpDelete("{userId:int}")]
        public async Task<ActionResult<ApiResponse<bool>>> Revoke(int userId)
        {
            await _service.RevokeAsync(userId, GetCurrentUserId(), GetClientIp());
            return Success(true, "Đã thu hồi mã QR đăng nhập!");
        }

        [HttpGet("{userId:int}/logs")]
        public async Task<ActionResult<ApiResponse<List<LoginQrLogDto>>>> GetLogs(int userId)
        {
            var data = await _service.GetLogsAsync(userId, LogPageSize);
            return Success(data, "Lấy nhật ký mã QR đăng nhập thành công!");
        }

        private int? GetCurrentUserId()
        {
            var claim = User.FindFirst(IdentityClaimTypes.UserId)?.Value;
            return int.TryParse(claim, out var id) ? id : null;
        }

        private string? GetClientIp() => HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
