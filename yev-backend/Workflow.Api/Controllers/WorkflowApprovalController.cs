using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.WorkflowRequests;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    // Duyệt qua email, không đăng nhập (Pha 4C — workflow-module.md §3.3, §6). Token trong URL là
    // credential DUY NHẤT (Workflow không có secondary password như Attendance) — kênh BỔ SUNG cho 2
    // nút Duyệt/Từ chối trong app, KHÔNG thay thế. Mirror OtFormController's email-confirm actions
    // (Attendance) nhưng tách riêng controller thay vì gộp vào WorkflowRequestController vì toàn bộ
    // action ở đây [AllowAnonymous] — giữ tách bạch rõ ràng "controller nào cần JWT" khỏi
    // WorkflowRequestController (mọi action còn lại đều sau RequirePermission).
    public class WorkflowApprovalController : WorkflowBaseController
    {
        private readonly IWorkflowRequestService _workflowRequestService;

        public WorkflowApprovalController(IWorkflowRequestService workflowRequestService)
        {
            _workflowRequestService = workflowRequestService;
        }

        [AllowAnonymous]
        [HttpGet("by-token/{token}")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> GetByToken(string token)
        {
            var result = await _workflowRequestService.GetByEmailTokenAsync(token);
            return Success(result);
        }

        [AllowAnonymous]
        [HttpPost("by-token/{token}/approve")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> ApproveByToken(string token, [FromBody] EmailApproveRequestDto request)
        {
            var result = await _workflowRequestService.ApproveByEmailTokenAsync(token, request);
            return Success(result, "Duyệt đơn thành công.");
        }

        [AllowAnonymous]
        [HttpPost("by-token/{token}/reject")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> RejectByToken(string token, [FromBody] EmailRejectRequestDto request)
        {
            var result = await _workflowRequestService.RejectByEmailTokenAsync(token, request);
            return Success(result, "Từ chối đơn thành công.");
        }
    }
}
