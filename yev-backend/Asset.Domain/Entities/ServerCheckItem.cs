using System;

namespace Asset.Domain.Entities;

// Snapshot of 1 checkable device (Server/Máy lạnh/UPS/Network — DeviceType.ServerCheckCategory != null)
// inside 1 ServerCheckSession. Category is copied at snapshot time so a later change to the DeviceType's
// category never rewrites past days' report.
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
