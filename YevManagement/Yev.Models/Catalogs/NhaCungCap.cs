using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;
using Yev.Entities.Devices;

namespace Yev.Entities.Catalogs
{
    public class NhaCungCap
    {
        [Key]
        public int Id { get; set; }
        [Required, MaxLength(50)]
        public string MaNhaCungCap { get; set; }
        [Required] [MaxLength(255)]
        public string TenNhaCungCap { get; set; }
        public  bool IsDeleted { get; set; } = false;

        public ICollection<ThietBi> ThietBis { get; set; } = new List<ThietBi>();
    }
}
