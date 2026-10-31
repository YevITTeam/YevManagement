namespace Workflow.Domain.Entities;

// Single-use and the only credential. Not bound to StepOrder: approval reloads the real Current step, so
// stale tokens fail naturally without invalidating sibling tokens.
public partial class WorkflowRequestEmailToken
{
    public int Id { get; set; }

    public int WorkflowRequestId { get; set; }

    public int StepOrder { get; set; }

    public int ApproverEmployeeId { get; set; }

    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual WorkflowRequest WorkflowRequest { get; set; } = null!;

    public virtual Employee ApproverEmployee { get; set; } = null!;
}
