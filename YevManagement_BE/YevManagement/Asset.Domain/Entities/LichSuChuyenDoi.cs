using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class LichSuChuyenDoi
{
    public int Id { get; set; }

    public int IdMayCu { get; set; }

    public int IdMayMoi { get; set; }

    public DateTime NgayChuyenDoi { get; set; }

    public string? GhiChu { get; set; }

    public virtual ThietBi IdMayCuNavigation { get; set; } = null!;

    public virtual ThietBi IdMayMoiNavigation { get; set; } = null!;
}
