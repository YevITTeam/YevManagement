using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class DeviceType
{
    public int Id { get; set; }

    public string TypeCode { get; set; } = null!;

    public string TypeName { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();
}
