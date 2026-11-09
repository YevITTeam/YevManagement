namespace Attendance.Domain.Entities;

// Someone from elsewhere in the Department lent to this Group: may create its forms and, when their title is one of
// its steps, approve them. Their own GroupId/JobTitle stay untouched and the chain still skips steps by their rank.
public partial class GroupBorrowedApprover
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int EmployeeId { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
