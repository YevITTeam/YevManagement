using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class DeviceType
{
    public int Id { get; set; }

    public string TypeCode { get; set; } = null!;

    public string TypeName { get; set; } = null!;

    // Non-null = this DeviceType is in scope for the daily QR server-room check, grouped into one of the
    // 4 report columns (Asset.Domain.Enums.ServerCheckCategory). Null = not checked daily (ordinary PC etc.)
    public int? ServerCheckCategory { get; set; }

    // True = devices of this type are physically scanned by QR during the daily check (only iDRAC/SAN
    // hardware in the server room). False = ticked devices are verified by ping at session end instead
    // (or auto-OK when they have no IP, e.g. air conditioners) — see asset-module.md §1.19.
    public bool RequiresQrScan { get; set; }

    // True = devices of this type are snapshotted into an inventory session (asset-module.md §1.22).
    // Existing types default to true when the column was added.
    public bool IncludedInInventory { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();
}
