using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class ChiNhanh
{
    public int Id { get; set; }

    public string MaChiNhanh { get; set; } = null!;

    public string TenChiNhanh { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<ThietBi> ThietBis { get; set; } = new List<ThietBi>();
}
