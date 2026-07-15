using Attendance.Application.Dtos.UserSignatures;
using Attendance.Application.Interfaces.Service;
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

        // Mỗi user (Trưởng Group/Trưởng phòng/Trưởng xưởng...) xem chữ ký đã đăng ký của CHÍNH mình.
        [RequirePermission("Attendance.UserSignature.Update")]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<UserSignatureDto>>> GetMine()
        {
            var result = await _userSignatureService.GetByUserNameAsync(CurrentUserName);
            return Success(result);
        }

        // Đăng ký/cập nhật chữ ký của CHÍNH mình — dùng auto-fill lúc duyệt (xem docs/attendance-module.md).
        [RequirePermission("Attendance.UserSignature.Update")]
        [HttpPut("me")]
        public async Task<ActionResult<ApiResponse<UserSignatureDto>>> UpsertMine([FromBody] UpsertUserSignatureDto request)
        {
            var result = await _userSignatureService.UpsertAsync(CurrentUserName, request);
            return Success(result, "Cập nhật chữ ký thành công.");
        }

        // Admin xem chữ ký đã đăng ký của người khác.
        [RequirePermission("Attendance.UserSignature.View")]
        [HttpGet("{userName}")]
        public async Task<ActionResult<ApiResponse<UserSignatureDto>>> GetByUserName(string userName)
        {
            var result = await _userSignatureService.GetByUserNameAsync(userName);
            return Success(result);
        }
    }
}
