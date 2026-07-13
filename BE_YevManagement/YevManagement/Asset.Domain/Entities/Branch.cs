using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class Branch
{
    public int Id { get; set; }

    public string BranchCode { get; set; } = null!;

    public string BranchName { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();

    public virtual ICollection<IpPrefix> IpPrefixes { get; set; } = new List<IpPrefix>();
}
