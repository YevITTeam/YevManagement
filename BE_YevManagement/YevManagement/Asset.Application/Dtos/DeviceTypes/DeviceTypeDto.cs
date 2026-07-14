using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.DeviceTypes
{
    public class DeviceTypeDto
    {
        public int Id { get; set; }
        public string TypeCode { get; set; } = null!;
        public string TypeName { get; set; } = null!;
    }
}
