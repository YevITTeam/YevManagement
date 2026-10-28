namespace Attendance.Domain.Entities;

// A Team Leader of another Group (same Department) who approves this Group's Team Leader step;
// their own GroupId/JobTitle stay untouched.
public partial class GroupBorrowedApprover
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int EmployeeId { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
