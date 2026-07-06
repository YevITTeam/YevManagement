using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class LoaiThietBi
{
    public int Id { get; set; }

    public string MaLoai { get; set; } = null!;

    public string TenLoai { get; set; } = null!;

    public bool IsDeleted { get; set; }

    public virtual ICollection<ThietBi> ThietBis { get; set; } = new List<ThietBi>();
}
