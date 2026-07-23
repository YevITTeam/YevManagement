using System;
using System.Collections.Generic;

namespace Asset.Domain.Models;

public partial class AuditTrail
{
    public long Id { get; set; }

    public string TableName { get; set; } = null!;

    public int RecordId { get; set; }

    /// <summary>
    /// Human readable identifier of the affected record (device code, IP address, prefix...)
    /// so the log can be read without joining back to the source table.
    /// For a grouped (bulk) entry this holds a range summary instead of a single name.
    /// </summary>
    public string? RecordName { get; set; }

    /// <summary>
    /// How many records this single audit row represents. 1 for a normal operation,
    /// N when a bulk operation (e.g. generating 255 IPs of a prefix) was collapsed into one row.
    /// </summary>
    public int AffectedCount { get; set; } = 1;

    public string Action { get; set; } = null!;

    public string? OldValues { get; set; }

    public string? NewValues { get; set; }

    public string ChangedBy { get; set; } = null!;

    public DateTime ChangedAt { get; set; }
}
