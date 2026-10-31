using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    public class ApproveRequestDto
    {
        [MaxLength(1000)]
        public string? Comment { get; set; }

        // Snapshot taken at approval time, not a reference to EmployeeSignatures.
        public string? SignatureImageBase64 { get; set; }

        // Needed only when the caller is both a direct approver and a delegate on the same step; when empty,
        // acts as self if a direct approver, otherwise uses any active delegation.
        public int? OnBehalfOfEmployeeId { get; set; }
    }

    public class RejectRequestDto
    {
        [Required(ErrorMessage = "Lý do từ chối không được để trống")]
        [MaxLength(1000)]
        public string Comment { get; set; } = null!;

        public int? OnBehalfOfEmployeeId { get; set; }
    }

    public class SendBackRequestDto
    {
        // 0 = back to the requester.
        public int TargetStepOrder { get; set; }

        [MaxLength(1000)]
        public string? Comment { get; set; }

        public int? OnBehalfOfEmployeeId { get; set; }
    }

    public class AddApproverRequestDto
    {
        [Required(ErrorMessage = "Nhân sự không được để trống")]
        public int EmployeeId { get; set; }

        public int InsertAfterStepOrder { get; set; }

        [MaxLength(200)]
        public string? NameVn { get; set; }

        public int? OnBehalfOfEmployeeId { get; set; }
    }

    public class CancelRequestDto
    {
        [MaxLength(500)]
        public string? Reason { get; set; }
    }

    // Resubmits a SentBack request. Edit DataJson via UpdateDraftAsync first, then call this to push
    // the target step back to Current — approvers are not re-resolved.
    public class ResubmitRequestDto
    {
        [MaxLength(1000)]
        public string? Comment { get; set; }
    }
}
