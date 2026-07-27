namespace Attendance.Domain.Enums;

// The type of scope a UserApprovalScope points to (which table ScopeId corresponds to).
// OtForm only keeps GroupId/DepartmentId (AreaId/LineId removed), so ScopeType only has these 2 values.
public enum ScopeType
{
    Group = 0,
    Department = 1
}
