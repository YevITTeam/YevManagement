using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Bước duyệt của MỘT nhánh (workflow-module.md §3.2). RequireSignature đặt ở BƯỚC, không ở JobTitle —
// cùng chức danh có thể cần ký ở phòng này nhưng chỉ cần xác nhận ở phòng khác.
public partial class FormApprovalStep
{
    public int Id { get; set; }

    public int FormRouteId { get; set; }

    public int StepOrder { get; set; }

    public string NameVn { get; set; } = null!;

    public string? NameJp { get; set; }

    public StepType StepType { get; set; }

    public OrgUnitScope OrgUnitScope { get; set; }

    public int? OrgUnitId { get; set; }

    public ApproverMode ApproverMode { get; set; }

    public bool RequireSignature { get; set; }

    public bool AllowSendBack { get; set; } = true;

    public bool AllowAddApprover { get; set; }

    public bool IsDeleted { get; set; }

    public virtual FormRoute FormRoute { get; set; } = null!;

    public virtual OrgUnit? OrgUnit { get; set; }

    public virtual ICollection<FormApprovalStepParticipant> FormApprovalStepParticipants { get; set; } = new List<FormApprovalStepParticipant>();
}
