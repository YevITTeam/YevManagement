using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;
using Yev.Entities.Devices;

namespace Yev.Entities.Catalogs
{
    public class PhanMem
    {
        [Key]
        public int Id { get; set; }
        [Required, MaxLength(50)]
        public string MaPhanMem { get; set; }
        [Required, MaxLength(255)]
        public string TenPhanMem { get; set; }
        [MaxLength(150)]
        public string? NhaPhatHanh { get; set; }
        public bool IsDeleted { get; set; } = false;

        public ICollection<ThietBi_PhanMem> ThietBi_PhanMems { get; set; } = new List<ThietBi_PhanMem>();
    }
}
