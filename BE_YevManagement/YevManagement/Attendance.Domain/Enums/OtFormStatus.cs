namespace Attendance.Domain.Enums;

// Song song với ApprovalLevel: đơn dừng ở đúng trạng thái ứng với OtCase.RequiredApprovalLevel của nó
// (vd TH1/RequiredApprovalLevel=DepartmentManager thì ApprovedByDepartment == Completed).
public enum OtFormStatus
{
    Pending = 0,
    ApprovedByDepartment = 1,
    ApprovedByWorkshop = 2,
    Completed = 3,
    Rejected = 4,

    // Đơn vừa được "người tạo đơn" tạo, CHƯA được Trưởng nhóm ký duyệt (xem docs/attendance-module.md
    // §Business Logic — Draft chỉ chuyển sang PendingGroupHead sau khi Trưởng nhóm gọi POST /{id}/submit).
    // Gán số 5 (thêm cuối) thay vì chèn lên đầu để không đổi giá trị int của các trạng thái cũ đã lưu DB.
    Draft = 5,

    // Đã có chữ ký Trưởng nhóm (Submitter), đang chờ Trưởng Bộ phận (ApprovalLevel.GroupHead) ký —
    // MỚI 2026-07-17, chèn giữa Draft và Pending trong luồng thật (Trưởng nhóm -> Trưởng Bộ phận ->
    // Trưởng phòng), gán số 6 (thêm cuối) cùng nguyên tắc với Draft = 5 ở trên.
    PendingGroupHead = 6
}
