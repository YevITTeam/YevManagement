namespace Attendance.Domain.Entities;

// While active, the delegate may act on any step whose candidates include the delegator.
public partial class ApprovalDelegation
{
    public int Id { get; set; }

    public int DelegatorEmployeeId { get; set; }

    public int DelegateEmployeeId { get; set; }

    // Inclusive calendar days in Vietnam time.
    public DateOnly FromDate { get; set; }

    public DateOnly ToDate { get; set; }

    public string? Reason { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Employee DelegatorEmployee { get; set; } = null!;

    public virtual Employee DelegateEmployee { get; set; } = null!;
}
