using System;

namespace Attendance.Domain.Entities;

// Signature pre-registered per User — only used to auto-fill during approval, not the source of truth for audit
// (the actual value is stored as a snapshot in OtFormApprovalHistory.SignatureImage).
public partial class UserSignature
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public byte[] SignatureImage { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }
}
