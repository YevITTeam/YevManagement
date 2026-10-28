namespace Attendance.Domain.Entities;

// One (Workshop, Department) pair a Department Manager (JobTitle.TerminalLevel = DepartmentManager)
// approves for. Employee.DepartmentId mirrors the first pair so legacy single-department reads keep working.
public partial class EmployeeApprovalScope
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public int WorkshopId { get; set; }

    public int DepartmentId { get; set; }

    public virtual Employee Employee { get; set; } = null!;

    public virtual Workshop Workshop { get; set; } = null!;

    public virtual Department Department { get; set; } = null!;
}
