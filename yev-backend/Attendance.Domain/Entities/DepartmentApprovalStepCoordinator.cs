namespace Attendance.Domain.Entities;

// Manually assigned (not derived from JobTitle); must belong to this department. Grants only take effect once the
// Employee has a UserName. Does not cover the department's groups — those need GroupApprovalStepCoordinator.
public partial class DepartmentApprovalStepCoordinator
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }

    public int EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Department Department { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
