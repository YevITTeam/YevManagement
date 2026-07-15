using System;

namespace Attendance.Domain.Entities;

// Lịch sử duyệt từng cấp của 1 OtForm — mỗi dòng là 1 lần Submit/Approve/Reject, kèm chữ ký (nếu OtCase.RequireSignature).
public partial class OtFormApprovalHistory
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    // Người tạo/duyệt — lưu UserName, cùng lý do với OtForm.CreatedByUserName.
    public string ApproverUserName { get; set; } = null!;

    // Lưu enum Attendance.Domain.Enums.ApprovalLevel dưới dạng int.
    public int ApprovalLevel { get; set; }

    // Lưu enum Attendance.Domain.Enums.ApprovalAction dưới dạng int.
    public int Action { get; set; }

    public string? Comment { get; set; }

    // Snapshot ảnh chữ ký tại thời điểm ký — không tham chiếu ngược UserSignature để tránh chữ ký cũ
    // bị đổi theo khi user cập nhật chữ ký mới (xem docs/attendance-module.md).
    public byte[]? SignatureImage { get; set; }

    public DateTime ActionAt { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;
}
