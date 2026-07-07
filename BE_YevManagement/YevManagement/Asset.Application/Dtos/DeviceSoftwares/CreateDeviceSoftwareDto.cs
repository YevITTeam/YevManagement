using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.DeviceSoftwares
{
    public class CreateDeviceSoftwareDto
    {
        [Required(ErrorMessage = "Thiết bị không được để trống")]
        public int DeviceId { get; set; }

        [Required(ErrorMessage = "Phần mềm không được để trống")]
        public int SoftwareId { get; set; }

        public DateTime InstallDate { get; set; } = DateTime.UtcNow;
        public string? LicenseKey { get; set; }
    }
}
