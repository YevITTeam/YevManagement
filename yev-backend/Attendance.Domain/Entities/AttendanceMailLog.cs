using System;

namespace Attendance.Domain.Entities;

// One row per mail Attendance tries to send; the outbox sender updates Status as delivery succeeds or fails.
public partial class AttendanceMailLog
{
    public long Id { get; set; }

    public string? RecipientUserName { get; set; }

    // Null when the recipient has no email (Status = Skipped).
    public string? ToEmail { get; set; }

    public string Subject { get; set; } = null!;

    public int Status { get; set; }

    public int Attempts { get; set; }

    public string? LastError { get; set; }

    public string RequestedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? SentAt { get; set; }
}
