namespace Workflow.Domain.Entities;

// Single-level only; A->B->C chains are blocked in ApprovalDelegationService.
public partial class ApprovalDelegation
{
    public int Id { get; set; }

    public int DelegatorEmployeeId { get; set; }

    public int DelegateEmployeeId { get; set; }

    public int? FormDefinitionId { get; set; }

    public DateTime FromDate { get; set; }

    public DateTime ToDate { get; set; }

    public string? Reason { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Employee DelegatorEmployee { get; set; } = null!;

    public virtual Employee DelegateEmployee { get; set; } = null!;

    public virtual FormDefinition? FormDefinition { get; set; }
}
