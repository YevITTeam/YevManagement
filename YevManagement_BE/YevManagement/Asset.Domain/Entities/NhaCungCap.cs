using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class NhaCungCap
{
    public int Id { get; set; }

    public string MaNhaCungCap { get; set; } = null!;

    public string TenNhaCungCap { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<ThietBi> ThietBis { get; set; } = new List<ThietBi>();
}
