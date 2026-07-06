using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class PhanMem
{
    public int Id { get; set; }

    public string MaPhanMem { get; set; } = null!;

    public string TenPhanMem { get; set; } = null!;

    public string? NhaPhatHanh { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<ThietBiPhanMem> ThietBiPhanMems { get; set; } = new List<ThietBiPhanMem>();
}
