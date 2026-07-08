using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Softwares
{
    public class SoftwareDto
    {
        public int Id { get; set; }
        public string SoftwareCode { get; set; } = null!;
        public string SoftwareName { get; set; } = null!;
        public string? SoftwareType { get; set; }
        public string? Publisher { get; set; }
        public int? SoftwareQuantity { get; set; }
        public int? SoftwarePriority { get; set; }
        public int SoftwareGroupId { get; set; }
        public string SoftwareGroupName { get; set; } = null!;
    }
}
