using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text;
using Yev.Entities.Devices;

namespace Yev.Entities.Logs
{
    public class LichSuChuyenDoi
    {
        [Key]
        public int Id { get; set; }

        public int IdMayCu { get; set; }
        [ForeignKey("IdMayCu")]
        public ThietBi MayCu { get; set; }

        public int IdMayMoi { get; set; }
        [ForeignKey("IdMayMoi")]
        public ThietBi MayMoi { get; set; }

        public DateTime NgayChuyenDoi { get; set; } = DateTime.Now;
        [MaxLength(500)]
        public string? GhiChu { get; set; }
    }
}
