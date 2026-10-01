using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    public class ApproveRequestDto
    {
        [MaxLength(1000)]
        public string? Comment { get; set; }

        // byte[] <-> base64 trong JSON (AGENTS.md §4.4) — chụp tại thời điểm duyệt, KHÔNG trỏ về
        // EmployeeSignatures (workflow-module.md §3.3 WorkflowRequestHistories.SignatureImage).
        public string? SignatureImageBase64 { get; set; }

        // Chỉ cần điền khi người gọi VỪA là Approver trực tiếp của bước VỪA là Delegate của người
        // khác cùng bước đó — lúc đó hệ thống không tự suy được "duyệt với tư cách ai", phải chỉ định
        // rõ EmployeeId của người được duyệt thay. Để trống thì ưu tiên duyệt với tư cách bản thân nếu
        // là Approver trực tiếp, không thì tự tìm 1 ủy quyền còn hiệu lực bất kỳ.
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
        // 0 = trả về người nộp (workflow-module.md §5.6).
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
