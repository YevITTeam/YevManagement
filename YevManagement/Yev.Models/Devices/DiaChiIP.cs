using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Yev.Entities.Devices
{
    public class DiaChiIP
    {
        [Key]
        public int Id { get; set; }
        [Required, MaxLength(25)]
        public string DiaChi { get; set; }
        [MaxLength(15)]
        public string? SubnetMask { get; set; }
        [MaxLength(15)]
        public string? Gateway { get; set; }
        [MaxLength(15)]
        public string? PreferredDNS { get; set; }
        [MaxLength(15)]
        public string? AlternateDNS { get; set; }
        [MaxLength(15)]
        public string? ServerIP { get; set; }

        public int? ThietBiId { get; set; }
        public ThietBi? ThietBi { get; set; }

        public int TrangThai { get; set; } = 0; // 1: Hoạt động, 0: Ngừng hoạt động}
        [MaxLength(255)]
        public string? GhiChu { get; set; }
        public bool IsDeleted { get; set; } = false;
    }
}
