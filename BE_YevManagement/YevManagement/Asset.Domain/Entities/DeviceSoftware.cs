using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class DeviceSoftware
{
    public int DeviceId { get; set; }

    public int SoftwareId { get; set; }

    public DateTime InstallDate { get; set; }

    public string? LicenseKey { get; set; }

    public virtual Device Device { get; set; } = null!;

    public virtual Software Software { get; set; } = null!;
}
