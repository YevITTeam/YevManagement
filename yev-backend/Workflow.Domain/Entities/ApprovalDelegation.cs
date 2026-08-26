namespace Workflow.Domain.Entities;

// Ủy quyền duyệt thay - 代理承認 (workflow-module.md §3.4). Chỉ chấp nhận 1 cấp — chặn A->B->C ở
// Service (ApprovalDelegationService.GuardNoDelegationChainAsync).
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
