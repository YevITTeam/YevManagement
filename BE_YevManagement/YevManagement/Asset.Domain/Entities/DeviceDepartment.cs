using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class DeviceDepartment
{
    public int Id { get; set; }

    public string DepartmentCode { get; set; } = null!;

    public string DepartmentName { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();

    public virtual ICollection<DeviceGroup> DeviceGroups { get; set; } = new List<DeviceGroup>();
}
