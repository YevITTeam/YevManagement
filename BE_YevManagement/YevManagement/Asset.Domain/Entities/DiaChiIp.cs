using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class DiaChiIp
{
    public int Id { get; set; }

    public string DiaChi { get; set; } = null!;

    public string? SubnetMask { get; set; }

    public string? Gateway { get; set; }

    public string? PreferredDns { get; set; }

    public string? AlternateDns { get; set; }

    public string? ServerIp { get; set; }

    public int? ThietBiId { get; set; }

    public int TrangThai { get; set; }

    public string? GhiChu { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ThietBi? ThietBi { get; set; }
}
