using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.DeviceSoftwares
{
    public class DeviceSoftwareDto
    {
        public int DeviceId { get; set; }
        public int SoftwareId { get; set; }

        public string SoftwareName { get; set; } = null!;
        public DateTime InstallDate { get; set; }
        public string? LicenseKey { get; set; }
    }
}
