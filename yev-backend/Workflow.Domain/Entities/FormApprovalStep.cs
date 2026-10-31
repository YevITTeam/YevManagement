using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// RequireSignature lives on the step, not the JobTitle: the same title may need to sign in one unit but not another.
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
