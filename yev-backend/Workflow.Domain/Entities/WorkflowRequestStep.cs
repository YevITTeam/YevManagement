using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Snapshot luồng duyệt của riêng 1 đơn (workflow-module.md §3.3). StepOrder ở đây lệch +1 so với
// FormApprovalSteps.StepOrder cấu hình gốc (đánh số từ 0) — dành riêng giá trị 0 cho ý nghĩa "trả về
// người nộp" / "chưa vào luồng duyệt" (§5.1, §5.6), tránh đụng StepOrder=0 của bước duyệt đầu tiên.
// AllowAddApproverSnapshot KHÔNG có trong bảng liệt kê cột ở §3.3 (chỉ AllowSendBackSnapshot) — bổ
// sung ở Pha 3B-1 vì §5.6 cần cột này để biết bước có cho thêm người duyệt hay không SAU khi đã submit;
// WorkflowRequestStep không giữ FK ngược về FormApprovalStep gốc nên không còn cách nào tra lại.
public partial class WorkflowRequestStep
{
    public int Id { get; set; }

    public int WorkflowRequestId { get; set; }

    public int StepOrder { get; set; }

    public string StepNameSnapshot { get; set; } = null!;

    public StepType StepTypeSnapshot { get; set; }

    public string? OrgUnitNameSnapshot { get; set; }

    public ApproverMode ApproverModeSnapshot { get; set; }

    public bool RequireSignatureSnapshot { get; set; }

    public bool AllowSendBackSnapshot { get; set; }

    public bool AllowAddApproverSnapshot { get; set; }

    public StepStatus Status { get; set; }

    public bool IsAdHoc { get; set; }

    public int? InsertedByEmployeeId { get; set; }

    public int? ActedByEmployeeId { get; set; }

    public DateTime? ActedAt { get; set; }

    public virtual WorkflowRequest WorkflowRequest { get; set; } = null!;

    public virtual Employee? InsertedByEmployee { get; set; }

    public virtual Employee? ActedByEmployee { get; set; }

    public virtual ICollection<WorkflowRequestStepParticipant> WorkflowRequestStepParticipants { get; set; } = new List<WorkflowRequestStepParticipant>();
}
