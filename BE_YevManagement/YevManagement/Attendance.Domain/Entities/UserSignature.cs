using System;

namespace Attendance.Domain.Entities;

// Chữ ký đăng ký sẵn theo User — chỉ để auto-fill lúc duyệt, không phải nguồn sự thật cho audit
// (giá trị thật lưu snapshot trong OtFormApprovalHistory.SignatureImage).
public partial class UserSignature
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public byte[] SignatureImage { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}
