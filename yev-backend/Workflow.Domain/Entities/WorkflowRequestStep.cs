using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// StepOrder is FormApprovalSteps.StepOrder + 1, reserving 0 for "back to requester / not in flow".
// AllowAddApproverSnapshot is copied because there is no FK back to the source FormApprovalStep.
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
