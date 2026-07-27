using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;
using Shared.Application.Helper;

namespace Asset.Application.Dtos.DeviceSoftwares
{
    public class CreateDeviceSoftwareDto
    {
        [Required(ErrorMessage = "Thiết bị không được để trống")]
        public int DeviceId { get; set; }

        [Required(ErrorMessage = "Phần mềm không được để trống")]
        public int SoftwareId { get; set; }

        public DateTime InstallDate { get; set; } = TimeHelper.GetCurrentUtcTime();
        public string? LicenseKey { get; set; }
    }
}
