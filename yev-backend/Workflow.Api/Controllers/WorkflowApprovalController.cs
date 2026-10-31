using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.WorkflowRequests;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    // Email approval without login: the URL token is the only credential. Kept separate from
    // WorkflowRequestController so every [AllowAnonymous] action lives in one controller.
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
