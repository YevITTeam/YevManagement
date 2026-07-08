using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Asset.Application.Dtos.IpAddresses
{
    public class CreateIpAddressDto
    {
        [Required(ErrorMessage = "Địa chỉ IP không được để trống")]
        [RegularExpression(@"^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$",
            ErrorMessage = "Địa chỉ IP không đúng định dạng IPv4")]
        public string IpAddress { get; set; } = null!;

        [Required(ErrorMessage = "Prefix không được để trống")]
        public int IpPrefixId { get; set; }

        public string? ServerIp { get; set; }

        public int? DeviceId { get; set; }

        public int? Status { get; set; }

        public string? Note { get; set; }
    }
}
