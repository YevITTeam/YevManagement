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

        // Mỗi user xem trạng thái mật khẩu cấp 2 của CHÍNH mình — KHÔNG bao giờ trả hash/plaintext.
        [RequirePermission("Attendance.SecondaryPassword.Update")]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<SecondaryPasswordStatusDto>>> GetMine()
        {
            var result = await _secondaryPasswordService.GetStatusAsync(CurrentUserName);
            return Success(result);
        }

        // Đăng ký/cập nhật mật khẩu cấp 2 của CHÍNH mình — KHÔNG áp dụng ngay: gửi email xác nhận cho
        // chính người gọi, chỉ có hiệu lực sau khi bấm xác nhận (xem 2 action "confirm" bên dưới) —
        // chống trường hợp ai đó chiếm phiên đăng nhập rồi đổi mật khẩu cấp 2 hộ.
        [RequirePermission("Attendance.SecondaryPassword.Update")]
        [HttpPut("me")]
        public async Task<ActionResult<ApiResponse<bool>>> RequestUpsertMine([FromBody] UpsertSecondaryPasswordDto request)
        {
            await _secondaryPasswordService.RequestUpdateAsync(CurrentUserName, request);
            return Success(true, "Đã gửi email xác nhận thiết lập mật khẩu cấp 2 — vui lòng kiểm tra hộp thư trong 30 phút.");
        }

        // 2 action công khai bên dưới phục vụ trang xác nhận nhỏ mà FE mở khi người dùng bấm link
        // trong email (KHÔNG cần đăng nhập SPA) — token tự nó là thông tin xác thực duy nhất, cùng
        // pattern UserSignatureController (xem docs/attendance-module.md).
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
