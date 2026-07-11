using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.IpAddresses
{
    public class IpAddressDto
    {
        public int Id { get; set; }
        public string IpAddress { get; set; } = null!;
        public int? DeviceId { get; set; }
        // "Khác" khi Status = AssignedExternal (IP gán cho thiết bị ngoài hệ thống, không có
        // DeviceId); mã thiết bị thật khi Status = Assigned; null khi Available.
        public string? DeviceCode { get; set; }
        public int IpPrefixId { get; set; }
        public string Prefix { get; set; } = null!;
        public string? PrefixSubnetMask { get; set; }
        public string? PrefixGateway { get; set; }
        public string? PrefixPreferredDns { get; set; }
        public string? PrefixAlternateDns { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public string? Note { get; set; }
    }
}
