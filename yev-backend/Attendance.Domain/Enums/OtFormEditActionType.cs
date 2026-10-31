namespace Attendance.Domain.Enums;

// Approve/Reject are not logged here; OtFormApprovalHistory already records them.
public enum OtFormEditActionType
{
    TimeChanged = 0,
    NoteChanged = 1,
    EmployeeAdded = 2,
    EmployeeRemoved = 3,
    FormInfoChanged = 4,
    Resubmitted = 5
}
