namespace Attendance.Domain.Enums;

// Trạng thái của "Đơn tổng" — gom nhiều OtForm đang chờ đúng cấp DepartmentManager (status=0 Pending)
// của cùng 1 Department, xem docs/attendance-module.md §Đơn tổng.
public enum OtFormBatchStatus
{
    Pending = 0,
    Processed = 1
}
