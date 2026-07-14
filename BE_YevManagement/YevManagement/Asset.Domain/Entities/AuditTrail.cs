using System;
using System.Collections.Generic;

namespace Asset.Domain.Models;

public partial class AuditTrail
{
    public long Id { get; set; }

    public string TableName { get; set; } = null!;

    public int RecordId { get; set; }

    public string Action { get; set; } = null!;

    public string? OldValues { get; set; }

    public string? NewValues { get; set; }

    public string ChangedBy { get; set; } = null!;

    public DateTime ChangedAt { get; set; }
}
