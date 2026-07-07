using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public class Software
{
    public int Id { get; set; }
    public string SoftwareCode { get; set; } = null!;
    public string SoftwareName { get; set; } = null!;
    public string? SoftwareType { get; set; }
    public string? Publisher { get; set; }
    public int? SoftwareQuantity { get; set; }
    public int? SoftwarePriority { get; set; }
    public bool IsDeleted { get; set; }

    public int SoftwareGroupId { get; set; }
    public virtual SoftwareGroup SoftwareGroup { get; set; } = null!;

    public virtual ICollection<DeviceSoftware> DeviceSoftwares { get; set; } = new List<DeviceSoftware>();
}
