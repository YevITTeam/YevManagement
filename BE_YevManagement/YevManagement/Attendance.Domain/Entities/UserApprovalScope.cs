namespace Attendance.Domain.Entities;

// Maps a User (Identity, a different DB — stored as UserName) who is allowed to approve OtForm within
// which scope (ScopeType, ScopeId), at which approval level (ApprovalLevel). E.g.: UserName="nguyenvana" approves at
// DepartmentManager level for the Department with Id=5.
public partial class UserApprovalScope
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    // Stores the enum Attendance.Domain.Enums.ScopeType as an int.
    public int ScopeType { get; set; }

    // Id of the Area/Line/Group/Department corresponding to ScopeType — no real FK since it's polymorphic.
    public int ScopeId { get; set; }

    // Stores the enum Attendance.Domain.Enums.ApprovalLevel as an int.
    public int ApprovalLevel { get; set; }

    public bool IsDeleted { get; set; }
}
