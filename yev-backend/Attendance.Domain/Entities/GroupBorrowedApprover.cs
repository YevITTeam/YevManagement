namespace Attendance.Domain.Entities;

// ponytail: the app no longer reads this; kept so existing rows can be moved onto levels, then drop the table.
public partial class GroupBorrowedApprover
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int EmployeeId { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
