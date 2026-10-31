using Attendance.Application.Dtos.SecondaryPasswords;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class SecondaryPasswordController : BaseController
    {
        private readonly ISecondaryPasswordService _secondaryPasswordService;

        public SecondaryPasswordController(ISecondaryPasswordService secondaryPasswordService)
        {
            _secondaryPasswordService = secondaryPasswordService;
        }

        // Caller's own status only; never returns the hash or plaintext.
        [RequirePermission("Attendance.SecondaryPassword.Update")]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<SecondaryPasswordStatusDto>>> GetMine()
        {
            var result = await _secondaryPasswordService.GetStatusAsync(CurrentUserName);
            return Success(result);
        }

        // Not applied immediately: takes effect only after email confirmation, so a hijacked session can't change it.
        [RequirePermission("Attendance.SecondaryPassword.Update")]
        [HttpPut("me")]
        public async Task<ActionResult<ApiResponse<bool>>> RequestUpsertMine([FromBody] UpsertSecondaryPasswordDto request)
        {
            await _secondaryPasswordService.RequestUpdateAsync(CurrentUserName, request);
            return Success(true, "Đã gửi email xác nhận thiết lập mật khẩu cấp 2 — vui lòng kiểm tra hộp thư trong 30 phút.");
        }

        // Public endpoints for the email confirmation link; the token is the only credential.
        [AllowAnonymous]
        [HttpGet("confirm/{token}")]
        public async Task<ActionResult<ApiResponse<SecondaryPasswordConfirmationPreviewDto>>> GetPendingConfirmation(string token)
        {
            var result = await _secondaryPasswordService.GetPendingConfirmationAsync(token);
            return Success(result);
        }

        [AllowAnonymous]
        [HttpPost("confirm/{token}")]
        public async Task<ActionResult<ApiResponse<bool>>> ConfirmUpdate(string token)
        {
            await _secondaryPasswordService.ConfirmAsync(token);
            return Success(true, "Xác nhận thiết lập mật khẩu cấp 2 thành công.");
        }
    }
}
