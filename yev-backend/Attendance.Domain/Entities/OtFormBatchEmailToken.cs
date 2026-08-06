using System;

namespace Attendance.Domain.Entities;

// Email link token for the "Đơn tổng" batch approval flow — same one-token-per-send pattern as
// OtFormApprovalEmailToken, except there is no ApprovalLevel (a batch is always approved at the
// DepartmentManager level) and IsReminder distinguishes the first notice from later reminder sends
// for the SAME still-unresolved batch (see docs/attendance-module.md — §Đơn tổng).
public partial class OtFormBatchEmailToken
{
    public int Id { get; set; }

    public int OtFormBatchId { get; set; }

    public string ApproverUserName { get; set; } = null!;

    public string? ApproverFullName { get; set; }

    public bool IsReminder { get; set; }

    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual OtFormBatch OtFormBatch { get; set; } = null!;
}
