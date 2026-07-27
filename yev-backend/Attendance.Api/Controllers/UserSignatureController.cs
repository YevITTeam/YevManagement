using Attendance.Application.Dtos.UserSignatures;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class UserSignatureController : BaseController
    {
        private readonly IUserSignatureService _userSignatureService;

        public UserSignatureController(IUserSignatureService userSignatureService)
        {
            _userSignatureService = userSignatureService;
        }

        // Mỗi user (Trưởng nhóm/Trưởng phòng/Trưởng xưởng...) xem chữ ký đã đăng ký của CHÍNH mình.
        [RequirePermission("Attendance.UserSignature.Update")]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<UserSignatureDto>>> GetMine()
        {
            var result = await _userSignatureService.GetByUserNameAsync(CurrentUserName);
            return Success(result);
        }

        // Đăng ký/cập nhật chữ ký của CHÍNH mình — KHÔNG còn áp dụng ngay (2026-07-16): gửi email
        // xác nhận cho chính người gọi, chữ ký chỉ có hiệu lực sau khi bấm xác nhận (xem 2 action
        // "confirm" bên dưới) — chống trường hợp ai đó chiếm phiên đăng nhập rồi đổi chữ ký.
        [RequirePermission("Attendance.UserSignature.Update")]
        [HttpPut("me")]
        public async Task<ActionResult<ApiResponse<bool>>> RequestUpsertMine([FromBody] UpsertUserSignatureDto request)
        {
            await _userSignatureService.RequestUpdateAsync(CurrentUserName, request);
            return Success(true, "Đã gửi email xác nhận cập nhật chữ ký — vui lòng kiểm tra hộp thư trong 30 phút.");
        }

        // Admin xem chữ ký đã đăng ký của người khác.
        [RequirePermission("Attendance.UserSignature.View")]
        [HttpGet("{userName}")]
        public async Task<ActionResult<ApiResponse<UserSignatureDto>>> GetByUserName(string userName)
        {
            var result = await _userSignatureService.GetByUserNameAsync(userName);
            return Success(result);
        }

        // 2 action công khai bên dưới phục vụ trang xác nhận nhỏ mà FE mở khi người dùng bấm link
        // trong email (KHÔNG cần đăng nhập SPA) — token tự nó là thông tin xác thực duy nhất, xem
        // docs/attendance-module.md. Đây là bề mặt [AllowAnonymous] đầu tiên của toàn hệ thống.
        [AllowAnonymous]
        [HttpGet("confirm/{token}")]
        public async Task<ActionResult<ApiResponse<SignatureConfirmationPreviewDto>>> GetPendingConfirmation(string token)
        {
            var result = await _userSignatureService.GetPendingConfirmationAsync(token);
            return Success(result);
        }

        [AllowAnonymous]
        [HttpPost("confirm/{token}")]
        public async Task<ActionResult<ApiResponse<UserSignatureDto>>> ConfirmUpdate(string token)
        {
            var result = await _userSignatureService.ConfirmAsync(token);
            return Success(result, "Xác nhận cập nhật chữ ký thành công.");
        }
    }
}
