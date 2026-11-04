using System;

namespace Attendance.Domain.Entities;

// Insert-only; written by AttendanceDbContext.SaveChangesAsync for every tracked change.
public partial class AttendanceAuditTrail
{
    public long Id { get; set; }

    public string TableName { get; set; } = null!;

    public int RecordId { get; set; }

    public string? RecordName { get; set; }

    // > 1 when one SaveChanges touched many rows of the same table/action (imports, approval chains).
    public int AffectedCount { get; set; } = 1;

    public string Action { get; set; } = null!;

    public string? OldValues { get; set; }

    public string? NewValues { get; set; }

    public string ChangedBy { get; set; } = null!;

    public DateTime ChangedAt { get; set; }
}
