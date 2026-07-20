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
        // "Other" when Status = AssignedExternal (IP assigned to a device outside the system,
        // no DeviceId); the actual device code when Status = Assigned; null when Available.
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
