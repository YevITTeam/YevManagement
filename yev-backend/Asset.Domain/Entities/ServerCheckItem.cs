using System;

namespace Asset.Domain.Entities;

// Snapshot of 1 checkable device in a session; Category is copied so later DeviceType changes don't rewrite past reports.
public partial class ServerCheckItem
{
    public int Id { get; set; }

    public int SessionId { get; set; }

    public int DeviceId { get; set; }

    public int Category { get; set; }

    public DateTime? ScannedAt { get; set; }

    public string? ScannedBy { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public virtual ServerCheckSession Session { get; set; } = null!;

    public virtual Device Device { get; set; } = null!;
}
