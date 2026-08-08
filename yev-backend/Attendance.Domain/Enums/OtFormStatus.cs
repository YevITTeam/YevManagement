namespace Attendance.Domain.Enums;

// Redesign sạch 2026-08-07 (Giai đoạn 3.1 — wiring Cây chức vụ vào luồng duyệt OT thật, xem
// docs/attendance-module.md §Cây chức vụ). Trạng thái CHI TIẾT (đang chờ ai, cấp nào) không còn nằm ở
// đây nữa — đọc từ OtFormApprovalStep (bước Pending có StepOrder nhỏ nhất = bước đang chờ xử lý).
// Không cần tương thích ngược với 6 giá trị cũ (Pending/ApprovedByDepartment/ApprovedByWorkshop/
// Completed/Rejected/Draft/PendingGroupHead) — toàn bộ dữ liệu OT cũ đã bị xoá cùng đợt migrate này.
public enum OtFormStatus
{
    InApproval = 0,
    Completed = 1,
    Rejected = 2
}
