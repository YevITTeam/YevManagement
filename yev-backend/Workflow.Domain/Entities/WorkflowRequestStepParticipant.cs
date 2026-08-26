using Workflow.Domain.Enums;

namespace Workflow.Domain.Entities;

// Snapshot người, ĐÃ resolve ra người thật lúc nộp (workflow-module.md §3.3, §5.5).
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
