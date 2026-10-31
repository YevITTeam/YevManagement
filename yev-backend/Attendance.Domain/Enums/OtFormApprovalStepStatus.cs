namespace Attendance.Domain.Enums;

// All steps are created Pending at snapshot time; the current step is the Pending one with the lowest StepOrder.
public enum OtFormApprovalStepStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,

    // Remaining Pending steps after a rejection.
    Skipped = 3
}
