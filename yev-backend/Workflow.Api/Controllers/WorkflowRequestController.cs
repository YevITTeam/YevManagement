using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.WorkflowRequests;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    // Who may approve/view a request is data (step participants + delegations), not permissions:
    // every action sits behind Workflow.Request.Create only and the Service enforces the details.
    public class WorkflowRequestController : WorkflowBaseController
    {
        private readonly IWorkflowRequestService _workflowRequestService;

        public WorkflowRequestController(IWorkflowRequestService workflowRequestService)
        {
            _workflowRequestService = workflowRequestService;
        }

        private bool HasViewAll => User.HasClaim("Permission", "Workflow.Request.ViewAll");

        // Requesters usually lack Workflow.FormDesign.View, so form definitions are re-exposed here.
        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("available-forms")]
        public async Task<ActionResult<ApiResponse<List<AvailableFormDto>>>> GetAvailableForms()
        {
            var result = await _workflowRequestService.GetAvailableFormsAsync(CurrentUserId);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("form-schema/{formDefinitionId}")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestFormSchemaDto>>> GetFormSchema(int formDefinitionId)
        {
            var result = await _workflowRequestService.GetFormSchemaAsync(formDefinitionId, CurrentUserId);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("my-employee")]
        public async Task<ActionResult<ApiResponse<MyEmployeeDto>>> GetMyEmployee()
        {
            var result = await _workflowRequestService.GetMyEmployeeAsync(CurrentUserId);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost]
        public async Task<IActionResult> CreateDraft([FromBody] CreateWorkflowRequestDraftDto request)
        {
            var result = await _workflowRequestService.CreateDraftAsync(request, CurrentUserId);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Tạo nháp đơn thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> UpdateDraft(int id, [FromBody] UpdateWorkflowRequestDraftDto request)
        {
            var result = await _workflowRequestService.UpdateDraftAsync(id, request, CurrentUserId);
            return Success(result, "Cập nhật nháp đơn thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> GetById(int id)
        {
            var result = await _workflowRequestService.GetByIdAsync(id, CurrentUserId, HasViewAll);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("my-requests")]
        public async Task<ActionResult<ApiResponse<PagedResponse<WorkflowRequestListItemDto>>>> GetMyRequests(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20, [FromQuery] int? status = null)
        {
            var result = await _workflowRequestService.GetMyRequestsAsync(CurrentUserId, pageIndex, pageSize, status);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("pending-my-approval")]
        public async Task<ActionResult<ApiResponse<PagedResponse<WorkflowRequestListItemDto>>>> GetPendingMyApproval(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _workflowRequestService.GetPendingMyApprovalAsync(CurrentUserId, pageIndex, pageSize);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("visible-to-me")]
        public async Task<ActionResult<ApiResponse<PagedResponse<WorkflowRequestListItemDto>>>> GetVisibleToMe(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20, [FromQuery] int? status = null)
        {
            var result = await _workflowRequestService.GetVisibleToMeAsync(CurrentUserId, HasViewAll, pageIndex, pageSize, status);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/submit")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> Submit(int id)
        {
            var result = await _workflowRequestService.SubmitAsync(id, CurrentUserId);
            return Success(result, "Nộp đơn thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/cancel")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> Cancel(int id, [FromBody] CancelRequestDto request)
        {
            var result = await _workflowRequestService.CancelAsync(id, request, CurrentUserId);
            return Success(result, "Hủy đơn thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> Approve(int id, [FromBody] ApproveRequestDto request)
        {
            var result = await _workflowRequestService.ApproveAsync(id, request, CurrentUserId);
            return Success(result, "Duyệt đơn thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/reject")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> Reject(int id, [FromBody] RejectRequestDto request)
        {
            var result = await _workflowRequestService.RejectAsync(id, request, CurrentUserId);
            return Success(result, "Từ chối đơn thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/send-back")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> SendBack(int id, [FromBody] SendBackRequestDto request)
        {
            var result = await _workflowRequestService.SendBackAsync(id, request, CurrentUserId);
            return Success(result, "Trả về thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/resubmit")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> Resubmit(int id, [FromBody] ResubmitRequestDto request)
        {
            var result = await _workflowRequestService.ResubmitAsync(id, request, CurrentUserId);
            return Success(result, "Nộp lại đơn thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/add-approver")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> AddApprover(int id, [FromBody] AddApproverRequestDto request)
        {
            var result = await _workflowRequestService.AddApproverAsync(id, request, CurrentUserId);
            return Success(result, "Thêm người duyệt thành công.");
        }

        // Upload/Delete: request owner only (enforced in Service); Download follows the view rule, hence HasViewAll.
        [RequirePermission("Workflow.Request.Create")]
        [HttpPost("{id}/attachments")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> UploadAttachment(int id, IFormFile file)
        {
            if (file is null || file.Length == 0)
                return Fail<WorkflowRequestDto>("Vui lòng chọn file để tải lên.");

            await using var stream = file.OpenReadStream();
            var result = await _workflowRequestService.UploadAttachmentAsync(id, stream, file.FileName, file.ContentType, file.Length, CurrentUserId);
            return Success(result, "Tải file đính kèm thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpDelete("attachments/{attachmentId}")]
        public async Task<ActionResult<ApiResponse<WorkflowRequestDto>>> DeleteAttachment(int attachmentId)
        {
            var result = await _workflowRequestService.DeleteAttachmentAsync(attachmentId, CurrentUserId);
            return Success(result, "Xoá file đính kèm thành công.");
        }

        // Raw file, not wrapped in ApiResponse<T>, so the browser downloads via Content-Disposition.
        [RequirePermission("Workflow.Request.Create")]
        [HttpGet("attachments/{attachmentId}/download")]
        public async Task<IActionResult> DownloadAttachment(int attachmentId)
        {
            var result = await _workflowRequestService.DownloadAttachmentAsync(attachmentId, CurrentUserId, HasViewAll);
            return PhysicalFile(result.PhysicalPath, result.ContentType, result.OriginalFileName);
        }
    }
}
