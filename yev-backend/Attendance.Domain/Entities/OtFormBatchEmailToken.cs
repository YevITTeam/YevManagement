using System;

namespace Attendance.Domain.Entities;

// IsReminder separates the first notice from later reminders for the same unresolved batch.
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
