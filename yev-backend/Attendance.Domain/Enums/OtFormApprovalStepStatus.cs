namespace Attendance.Domain.Enums;

// Trạng thái của 1 dòng OtFormApprovalStep — mọi bước được tạo Pending hết ngay lúc snapshot chuỗi
// duyệt (CreateAsync); bước "đang chờ xử lý" thật sự là bước Pending có StepOrder NHỎ NHẤT của đơn đó
// (StepOrder lớn hơn vẫn Pending nhưng chưa tới lượt — xem OtFormService).
public enum OtFormApprovalStepStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,

    // Đơn bị từ chối ở 1 bước nào đó — mọi bước Pending còn lại (StepOrder lớn hơn) chuyển Skipped.
    Skipped = 3
}
