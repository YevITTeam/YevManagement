namespace Attendance.Domain.Enums;

// DTO-only (not persisted); each child form still records its own OtFormApprovalHistory.
public enum OtFormBatchFormDecision
{
    Approve = 0,
    Reject = 1
}
