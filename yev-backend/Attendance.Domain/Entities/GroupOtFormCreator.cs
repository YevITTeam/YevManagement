namespace Attendance.Domain.Entities;

// An employee of another Group (same Department) allowed to create office OT forms for this Group;
// their own GroupId stays untouched and the chain still skips steps by their JobTitle rank.
public partial class GroupOtFormCreator
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int EmployeeId { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
