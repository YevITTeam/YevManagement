using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.EmployeeSignatures;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    // Chữ ký đăng ký sẵn — Pha 4 (workflow-module.md §3.4, §10). Mỗi người tự quản lý chữ ký của CHÍNH
    // mình, dùng để tự điền lúc duyệt đơn thay vì phải tải ảnh lên mỗi lần.
    public class EmployeeSignatureController : WorkflowBaseController
    {
        private readonly IEmployeeSignatureService _employeeSignatureService;

        public EmployeeSignatureController(IEmployeeSignatureService employeeSignatureService)
        {
            _employeeSignatureService = employeeSignatureService;
        }

        [RequirePermission("Workflow.Signature.Update")]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<EmployeeSignatureDto>>> GetMine()
        {
            var result = await _employeeSignatureService.GetMineAsync(CurrentUserId);
            return Success(result);
        }

        // Đăng ký/cập nhật chữ ký của CHÍNH mình — KHÔNG áp dụng ngay: gửi email xác nhận cho chính
        // người gọi, chữ ký chỉ có hiệu lực sau khi bấm xác nhận (xem 2 action "confirm" bên dưới) —
        // chống trường hợp ai đó chiếm phiên đăng nhập rồi đổi chữ ký hộ người khác.
        [RequirePermission("Workflow.Signature.Update")]
        [HttpPut("me")]
        public async Task<ActionResult<ApiResponse<bool>>> RequestUpsertMine([FromBody] UpsertEmployeeSignatureDto request)
        {
            await _employeeSignatureService.RequestUpdateAsync(CurrentUserId, request);
            return Success(true, "Đã gửi email xác nhận cập nhật chữ ký — vui lòng kiểm tra hộp thư trong 30 phút.");
        }

        // 2 action công khai bên dưới phục vụ trang xác nhận nhỏ mà FE mở khi người dùng bấm link
        // trong email (KHÔNG cần đăng nhập SPA) — token tự nó là thông tin xác thực duy nhất, mirror
        // Attendance.UserSignatureController.
        [AllowAnonymous]
        [HttpGet("confirm/{token}")]
        public async Task<ActionResult<ApiResponse<SignatureConfirmationPreviewDto>>> GetPendingConfirmation(string token)
        {
            var result = await _employeeSignatureService.GetPendingConfirmationAsync(token);
            return Success(result);
        }

        [AllowAnonymous]
        [HttpPost("confirm/{token}")]
        public async Task<ActionResult<ApiResponse<EmployeeSignatureDto>>> ConfirmUpdate(string token)
        {
            var result = await _employeeSignatureService.ConfirmAsync(token);
            return Success(result, "Xác nhận cập nhật chữ ký thành công.");
        }
    }
}
