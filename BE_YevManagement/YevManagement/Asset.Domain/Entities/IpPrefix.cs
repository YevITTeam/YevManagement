using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class IpPrefix
{
    public int Id { get; set; }

    public string Prefix { get; set; } = null!;

    public string? SubnetMask { get; set; }

    public string? Gateway { get; set; }

    public string? PreferredDns { get; set; }

    public string? AlternateDns { get; set; }

    public string? Description { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<IpAddress> IpAddresses { get; set; } = new List<IpAddress>();
}
