using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.DeviceTypes
{
    public class UpdateDeviceTypeDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Mã loại thiết bị không được để trống")]
        public string TypeCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên loại thiết bị không được để trống")]
        public string TypeName { get; set; } = null!;

        public int? ServerCheckCategory { get; set; }

        public bool RequiresQrScan { get; set; }
    }
}
