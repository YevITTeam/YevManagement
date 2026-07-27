using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class IpAddress
{
    public int Id { get; set; }

    public string IpAddress1 { get; set; } = null!;

    public int? DeviceId { get; set; }

    public int IpPrefixId { get; set; }

    public int Status { get; set; }

    public string? Note { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Device? Device { get; set; }

    public virtual IpPrefix IpPrefix { get; set; } = null!;
}
