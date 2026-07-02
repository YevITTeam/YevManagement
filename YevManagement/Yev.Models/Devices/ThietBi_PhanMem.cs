using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;
using Yev.Entities.Catalogs;

namespace Yev.Entities.Devices
{
    public class ThietBi_PhanMem
    {
        public int ThietBiId { get; set; }
        public ThietBi ThietBi { get; set; }

        public int PhanMemId { get; set; }
        public PhanMem PhanMem { get; set; }

        public DateTime NgayCaiDat { get; set; } = DateTime.Now;
        [MaxLength(255)]
        public string? LicenseKey { get; set; }
    }
}
