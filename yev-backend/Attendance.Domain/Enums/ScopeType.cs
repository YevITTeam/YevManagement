namespace Attendance.Domain.Enums;

// The type of scope a UserApprovalScope points to (which table ScopeId corresponds to).
// OtForm only keeps GroupId/DepartmentId (AreaId/LineId removed), so ScopeType only has these 2 values.
public enum ScopeType
{
    Group = 0,
    Department = 1,

    // Added 2026-08-05 — dedicated to ApprovalLevel.GeneralDirector: they approve company-wide, so
    // they can't be assigned to a single Group/Department like the other levels. ScopeId is
    // meaningless when ScopeType == All (always stored as 0, doesn't point to any table). Appended
    // at the end (not inserted before Department) to keep Group=0/Department=1 unchanged for rows
    // already stored in the DB — same principle as OtFormStatus.Draft = 5 / ApprovalLevel.GroupHead = 4.
    All = 2
}
