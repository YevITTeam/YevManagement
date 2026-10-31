using Shared.Application.Wrapper;
using Workflow.Application.Dtos.WorkflowRequests;

namespace Workflow.Application.Interfaces.Service
{
    public interface IWorkflowRequestService
    {
        Task<List<AvailableFormDto>> GetAvailableFormsAsync(int? currentUserId);
        Task<WorkflowRequestFormSchemaDto> GetFormSchemaAsync(int formDefinitionId, int? currentUserId);
        Task<MyEmployeeDto> GetMyEmployeeAsync(int? currentUserId);

        Task<WorkflowRequestDto> CreateDraftAsync(CreateWorkflowRequestDraftDto request, int? currentUserId);
        Task<WorkflowRequestDto> UpdateDraftAsync(int id, UpdateWorkflowRequestDraftDto request, int? currentUserId);
        Task<WorkflowRequestDto> GetByIdAsync(int id, int? currentUserId, bool hasViewAll);

        Task<PagedResponse<WorkflowRequestListItemDto>> GetMyRequestsAsync(int? currentUserId, int pageIndex, int pageSize, int? status);
        Task<PagedResponse<WorkflowRequestListItemDto>> GetPendingMyApprovalAsync(int? currentUserId, int pageIndex, int pageSize);
        Task<PagedResponse<WorkflowRequestListItemDto>> GetVisibleToMeAsync(int? currentUserId, bool hasViewAll, int pageIndex, int pageSize, int? status);

        Task<WorkflowRequestDto> SubmitAsync(int id, int? currentUserId);
        Task<WorkflowRequestDto> ApproveAsync(int id, ApproveRequestDto request, int? currentUserId);
        Task<WorkflowRequestDto> RejectAsync(int id, RejectRequestDto request, int? currentUserId);
        Task<WorkflowRequestDto> SendBackAsync(int id, SendBackRequestDto request, int? currentUserId);
        Task<WorkflowRequestDto> ResubmitAsync(int id, ResubmitRequestDto request, int? currentUserId);
        Task<WorkflowRequestDto> AddApproverAsync(int id, AddApproverRequestDto request, int? currentUserId);
        Task<WorkflowRequestDto> CancelAsync(int id, CancelRequestDto request, int? currentUserId);

        // Owner may add/remove until the request ends; others may only download if they can view the request.
        Task<WorkflowRequestDto> UploadAttachmentAsync(int workflowRequestId, Stream content, string originalFileName, string contentType, long fileSizeBytes, int? currentUserId);
        Task<WorkflowRequestDto> DeleteAttachmentAsync(int attachmentId, int? currentUserId);
        Task<WorkflowAttachmentDownloadDto> DownloadAttachmentAsync(int attachmentId, int? currentUserId, bool hasViewAll);

        // [AllowAnonymous] email approval: the token is the only credential.
        Task<WorkflowRequestDto> GetByEmailTokenAsync(string token);
        Task<WorkflowRequestDto> ApproveByEmailTokenAsync(string token, EmailApproveRequestDto request);
        Task<WorkflowRequestDto> RejectByEmailTokenAsync(string token, EmailRejectRequestDto request);
    }
}
