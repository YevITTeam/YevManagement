using System;

namespace Asset.Domain.Entities;

// Snapshot taken at session start; scans matching no item here are rejected, never added as new rows.
public partial class InventorySessionItem
{
    public int Id { get; set; }

    public int SessionId { get; set; }

    public int DeviceId { get; set; }

    public DateTime? ScannedAt { get; set; }

    public string? ScannedBy { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public virtual InventorySession Session { get; set; } = null!;

    public virtual Device Device { get; set; } = null!;
}
