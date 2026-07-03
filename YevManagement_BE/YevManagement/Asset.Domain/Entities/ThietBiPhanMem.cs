using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class ThietBiPhanMem
{
    public int ThietBiId { get; set; }

    public int PhanMemId { get; set; }

    public DateTime NgayCaiDat { get; set; }

    public string? LicenseKey { get; set; }

    public virtual PhanMem PhanMem { get; set; } = null!;

    public virtual ThietBi ThietBi { get; set; } = null!;
}
