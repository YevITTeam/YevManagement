namespace Attendance.Domain.Enums;

// Coarse status only; who/which level is pending lives in OtFormApprovalStep.
public enum OtFormStatus
{
    InApproval = 0,
    Completed = 1,
    Rejected = 2
}
