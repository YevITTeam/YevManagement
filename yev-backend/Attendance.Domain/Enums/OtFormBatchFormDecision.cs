namespace Attendance.Domain.Enums;

// Quyết định của Trưởng phòng cho TỪNG đơn nhỏ trong 1 "Đơn tổng" — chỉ dùng trong DTO xử lý batch,
// không lưu DB (mỗi đơn nhỏ vẫn ghi OtFormApprovalHistory bình thường qua ApproveAsync/RejectAsync).
public enum OtFormBatchFormDecision
{
    Approve = 0,
    Reject = 1
}
