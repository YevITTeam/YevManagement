using System;

namespace Attendance.Domain.Entities;

// Nhật ký chỉnh sửa đơn tăng ca sau khi tạo (2026-08-28, theo yêu cầu người dùng — "mọi thao tác thay
// đổi này cần log lại ai làm gì thay đổi cái gì và xem lại được"). Khác OtFormApprovalHistory (chỉ ghi
// Approve/Reject) — bảng này ghi CÁC THAY ĐỔI DỮ LIỆU: sửa giờ/ghi chú của 1 nhân viên, thêm/loại
// nhân viên khỏi đơn. 1 dòng = 1 field thay đổi (hoặc 1 hành động thêm/loại) — không gộp nhiều field
// vào 1 dòng để hiển thị rõ ràng theo đúng field/giá trị cũ→mới.
public partial class OtFormEditLog
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public string ActionByUserName { get; set; } = null!;

    // Snapshot tên đầy đủ lúc thao tác — cùng nguyên tắc snapshot với OtFormApprovalHistory.ApproverFullName.
    public string? ActionByFullName { get; set; }

    public DateTime ActionAt { get; set; }

    // Enum Attendance.Domain.Enums.OtFormEditActionType.
    public int ActionType { get; set; }

    // Nhân viên liên quan tới thay đổi này — null nếu là thay đổi cấp đơn (hiện chưa có trường hợp nào,
    // giữ nullable để mở rộng sau).
    public int? EmployeeId { get; set; }

    public string? EmployeeCodeSnapshot { get; set; }

    // Tên field đã đổi (vd "EndTime", "DidEat", "NoteVn", "NoteJp") — null khi ActionType là
    // EmployeeAdded/EmployeeRemoved (hành động, không phải đổi 1 field cụ thể).
    public string? FieldName { get; set; }

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
