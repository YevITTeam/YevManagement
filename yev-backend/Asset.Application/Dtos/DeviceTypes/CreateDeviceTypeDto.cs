using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.DeviceTypes
{
    public class CreateDeviceTypeDto
    {
        [Required(ErrorMessage = "Mã loại thiết bị không được để trống")]
        public string TypeCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên loại thiết bị không được để trống")]
        public string TypeName { get; set; } = null!;

        // Null = not part of the daily QR check. Values: Asset.Domain.Enums.ServerCheckCategory.
        public int? ServerCheckCategory { get; set; }

        // False = the system pings the device at session end instead of requiring a QR scan.
        public bool RequiresQrScan { get; set; }

        public bool IncludedInInventory { get; set; } = true;
    }
}
