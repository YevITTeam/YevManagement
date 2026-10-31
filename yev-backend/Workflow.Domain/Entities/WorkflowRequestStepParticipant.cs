using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Snapshot of the real person resolved at submit time.
public partial class WorkflowRequestStepParticipant
{
    public int Id { get; set; }

    public int WorkflowRequestStepId { get; set; }

    public int EmployeeId { get; set; }

    public ParticipantRole ParticipantRole { get; set; }

    public string? ResolvedFromJobTitle { get; set; }

    public DateTime? ActedAt { get; set; }

    public virtual WorkflowRequestStep WorkflowRequestStep { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
