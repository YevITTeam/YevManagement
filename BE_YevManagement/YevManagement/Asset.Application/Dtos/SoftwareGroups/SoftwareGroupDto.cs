using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.SoftwareGroups
{
    public class SoftwareGroupDto
    {
        public int Id { get; set; }
        public string GroupCode { get; set; } = null!;
        public string GroupName { get; set; } = null!;
    }
}
