namespace Attendance.Domain.Enums;

// Loại thao tác chỉnh sửa đơn được ghi vào OtFormEditLog (2026-08-28, theo yêu cầu người dùng —
// "mọi thao tác thay đổi này cần log lại ai làm gì thay đổi cái gì"). Không dùng chung với
// ApprovalAction (Approve/Reject đã có OtFormApprovalHistory riêng, không cần log lại ở đây).
public enum OtFormEditActionType
{
    TimeChanged = 0,
    NoteChanged = 1,
    EmployeeAdded = 2,
    EmployeeRemoved = 3,
    FormInfoChanged = 4
}
