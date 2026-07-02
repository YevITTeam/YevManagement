using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Yev.Entities.Logs
{
    public class AuditTrail
    {
        [Key]
        public long Id { get; set; }
        [Required, MaxLength(100)]
        public string TableName { get; set; }
        public int RecordId { get; set; }
        [Required, MaxLength(50)]
        public string Action { get; set; }
        public string? OldValues { get; set; } //Json
        public string? NewValues { get; set; } //Json
        [Required, MaxLength(150)]
        public string ChangedBy { get; set; }
        public DateTime ChangedAt { get; set; } = DateTime.Now;

    }
}
