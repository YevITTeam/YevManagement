using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class DeviceGroup
{
    public int Id { get; set; }

    public string GroupCode { get; set; } = null!;

    public string GroupName { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();
}
