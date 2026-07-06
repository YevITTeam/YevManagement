using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class IpAddress
{
    public int Id { get; set; }

    public string IpAddress1 { get; set; } = null!;

    public string? SubnetMask { get; set; }

    public string? Gateway { get; set; }

    public string? PreferredDns { get; set; }

    public string? AlternateDns { get; set; }

    public string? ServerIp { get; set; }

    public int? DeviceId { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Device? Device { get; set; }
}
