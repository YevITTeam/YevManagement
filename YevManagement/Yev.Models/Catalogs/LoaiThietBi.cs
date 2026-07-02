using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;
using Yev.Entities.Devices;

namespace Yev.Entities.Catalogs
{
    public class LoaiThietBi
    {
        [Key]
        public int Id { get; set; }
        [Required, MaxLength(50)]
        public string MaLoai { get; set; }
        [Required, MaxLength(255)]
        public string TenLoai { get; set; }
        public bool IsDeleted { get; set; } = false;

        public ICollection<ThietBi> ThietBis { get; set; } = new List<ThietBi>();
    }
}
