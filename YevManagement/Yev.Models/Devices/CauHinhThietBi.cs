using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Yev.Entities.Devices
{
    public class CauHinhThietBi
    {
        [Key]
        public int Id { get; set; }
        public int ThietBiId { get; set; }  
        public ThietBi ThietBi { get; set; }

        [MaxLength(150)]
        public string? Mainboard { get; set; }
        [MaxLength(150)]
        public string? CPU { get; set; }
        [MaxLength(150)]
        public string? RAM { get; set; }
        [MaxLength(150)]
        public string? OCung { get; set; }
        [MaxLength(150)]
        public string? Monitor { get; set; }
        [MaxLength(150)]
        public string? Mouse { get; set; }
        [MaxLength(150)]
        public string? Keyboard { get; set; }
        [MaxLength(150)]
        public string? Headphone { get; set; }
        [MaxLength(150)]
        public string? Speaker { get; set; }
        [MaxLength(150)]
        public string? UPS { get; set; }
        [MaxLength(150)]
        public string? PSU { get; set; }
        [MaxLength(150)]
        public string? OS { get; set; }
        [MaxLength(150)]
        public string? VGA { get; set; }
        [MaxLength(150)]
        public string? GhiChu { get; set; }

    }
}
