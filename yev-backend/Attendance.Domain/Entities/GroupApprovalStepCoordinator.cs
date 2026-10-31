namespace Attendance.Domain.Entities;

// Manually assigned; must belong to this group.
public partial class GroupApprovalStepCoordinator
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
