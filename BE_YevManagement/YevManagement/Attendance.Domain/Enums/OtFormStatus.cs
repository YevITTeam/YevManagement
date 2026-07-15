namespace Attendance.Domain.Enums;

// Song song với ApprovalLevel: đơn dừng ở đúng trạng thái ứng với OtCase.RequiredApprovalLevel của nó
// (vd TH1/RequiredApprovalLevel=DepartmentManager thì ApprovedByDepartment == Completed).
public enum OtFormStatus
{
    Pending = 0,
    ApprovedByDepartment = 1,
    ApprovedByWorkshop = 2,
    Completed = 3,
    Rejected = 4
}
