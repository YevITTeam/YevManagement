using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Domain.Entities
{
    public class SoftwareGroup
    {
        public int Id { get; set; }
        public string GroupCode { get; set; } = null!;
        public string GroupName { get; set; } = null!;
        public bool IsDeleted { get; set; }

        public virtual ICollection<Software> Softwares { get; set; } = new List<Software>();
    }
}
