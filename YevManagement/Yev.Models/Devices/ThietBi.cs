using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text;
using Yev.Entities.Catalogs;
using Yev.Entities.Logs;

namespace Yev.Entities.Devices
{
    public class ThietBi
    {
        [Key]
        public int Id { get; set; }
        [Required, MaxLength(50)]
        public string MaMay { get; set; }
        [Required, MaxLength(255)]
        public string TenMay { get; set; }

        public int LoaiThietBiId { get; set; }
        public LoaiThietBi LoaiThietBi { get; set; }

        public int NhaCungCapId { get; set; }
        public NhaCungCap NhaCungCap { get; set; }

        public int ChiNhanhId { get; set; }
        public ChiNhanh ChiNhanh { get; set; }

        [Required, MaxLength(150)]
        public string NguoiQuanLy { get; set; }
        [Required, MaxLength(255)]
        public string Email { get; set; }
        public DateTime NgayMua { get; set; }
        public DateTime? HanSuDung { get; set; }

        public int TrangThai { get; set; } // 1: Chờ, 2: Đang dùng, 3: Thanh lý, 4: Thuê Ngoài
        [MaxLength(500)]
        public string? GhiChu { get; set; }
        public bool IsDeleted { get; set; } = false;

        public ICollection<DiaChiIP> DiaChiIPs { get; set; } = new List<DiaChiIP>();
        public CauHinhThietBi CauHinhThietBi { get; set; }
        public ICollection<ThietBi_PhanMem> ThietBi_PhanMems { get; set; } = new List<ThietBi_PhanMem>();
        [InverseProperty("MayCu")]
        public ICollection<LichSuChuyenDoi> LichSuTuMayCu { get; set; } = new List<LichSuChuyenDoi>();
        [InverseProperty("MayMoi")]
        public ICollection<LichSuChuyenDoi> LichSuDenMayMoi { get; set; } = new List<LichSuChuyenDoi>();
    }
}
