using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.EmployeeSignatures;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
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

        // Not applied immediately: a confirmation email goes to the caller, so a hijacked session can't swap signatures.
        [RequirePermission("Workflow.Signature.Update")]
        [HttpPut("me")]
        public async Task<ActionResult<ApiResponse<bool>>> RequestUpsertMine([FromBody] UpsertEmployeeSignatureDto request)
        {
            await _employeeSignatureService.RequestUpdateAsync(CurrentUserId, request);
            return Success(true, "Đã gửi email xác nhận cập nhật chữ ký — vui lòng kiểm tra hộp thư trong 30 phút.");
        }

        // Public endpoints for the email-link confirmation page; the token is the only credential.
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
