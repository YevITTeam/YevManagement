namespace Attendance.Domain.Enums;

// AfterReject: the creator fixes a rejected office form and it restarts the whole chain.
// Resign: a flagged approver edits a Manager-signed office form; only the Manager signs again.
public enum OtFormResubmitKind
{
    AfterReject = 1,
    Resign = 2
}
