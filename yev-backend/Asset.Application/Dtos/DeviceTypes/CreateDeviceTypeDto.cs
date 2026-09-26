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

        // Null = không thuộc phạm vi kiểm tra hằng ngày (quét QR). Giá trị = Asset.Domain.Enums.ServerCheckCategory.
        public int? ServerCheckCategory { get; set; }

        // True = thiết bị loại này phải quét QR khi kiểm tra hằng ngày; false = hệ thống tự ping lúc kết thúc phiên.
        public bool RequiresQrScan { get; set; }
    }
}
