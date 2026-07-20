using System;

namespace Attendance.Domain.Entities;

// Token gửi kèm link email cho 1 người duyệt (Trưởng phòng/Trưởng xưởng/Tổng Giám Đốc) — kênh BỔ
// SUNG cho nút Duyệt/Từ chối có sẵn trong app, vì cấp quản lý ít khi mở app. Khi xác nhận, token
// này chỉ dùng để resolve ApproverUserName/ApprovalLevel rồi gọi thẳng OtFormService.ApproveAsync/
// RejectAsync đã có sẵn — không viết lại logic duyệt.
public partial class OtFormApprovalEmailToken
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    // Người duyệt cụ thể mà email này được gửi tới — snapshot tại lúc gửi mail, không tự đổi theo
    // UserApprovalScope hiện tại (đơn có thể có nhiều người cùng phạm vi, mỗi người có token riêng).
    public string ApproverUserName { get; set; } = null!;

    public string? ApproverFullName { get; set; }

    // Lưu enum Attendance.Domain.Enums.ApprovalLevel dưới dạng int — cấp duyệt tại thời điểm gửi
    // mail (DepartmentManager/WorkshopManager/GeneralDirector). ApproveAsync/RejectAsync vẫn tự
    // re-check theo Status hiện tại của đơn nên token cũ (đơn đã qua cấp) tự nhiên vô hiệu.
    public int ApprovalLevel { get; set; }

    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = chưa dùng. Có giá trị = đã bấm Duyệt hoặc Từ chối qua link này lúc nào.
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
