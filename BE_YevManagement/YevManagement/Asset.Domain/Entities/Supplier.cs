using System;
using System.Collections.Generic;

namespace Asset.Domain.Entities;

public partial class Supplier
{
    public int Id { get; set; }

    public string SupplierCode { get; set; } = null!;

    public string SupplierName { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<Device> Devices { get; set; } = new List<Device>();
}
