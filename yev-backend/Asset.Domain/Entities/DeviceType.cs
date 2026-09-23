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

    public bool IsDeleted { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();
}
