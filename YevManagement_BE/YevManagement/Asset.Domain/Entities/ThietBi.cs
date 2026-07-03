using System;
using System.Collections.Generic;

namespace Asset.Domain;

public partial class ThietBi
{
    public int Id { get; set; }

    public string MaMay { get; set; } = null!;

    public string TenMay { get; set; } = null!;

    public int LoaiThietBiId { get; set; }

    public int NhaCungCapId { get; set; }

    public int ChiNhanhId { get; set; }

    public string NguoiQuanLy { get; set; } = null!;

    public string Email { get; set; } = null!;

    public DateTime NgayMua { get; set; }

    public DateTime? HanSuDung { get; set; }

    public int TrangThai { get; set; }

    public string? GhiChu { get; set; }

    public bool IsDeleted { get; set; }

    public virtual CauHinhThietBi? CauHinhThietBi { get; set; }

    public virtual ChiNhanh ChiNhanh { get; set; } = null!;

    public virtual ICollection<DiaChiIp> DiaChiIps { get; set; } = new List<DiaChiIp>();

    public virtual ICollection<LichSuChuyenDoi> LichSuChuyenDoiIdMayCuNavigations { get; set; } = new List<LichSuChuyenDoi>();

    public virtual ICollection<LichSuChuyenDoi> LichSuChuyenDoiIdMayMoiNavigations { get; set; } = new List<LichSuChuyenDoi>();

    public virtual LoaiThietBi LoaiThietBi { get; set; } = null!;

    public virtual NhaCungCap NhaCungCap { get; set; } = null!;

    public virtual ICollection<ThietBiPhanMem> ThietBiPhanMems { get; set; } = new List<ThietBiPhanMem>();
}
