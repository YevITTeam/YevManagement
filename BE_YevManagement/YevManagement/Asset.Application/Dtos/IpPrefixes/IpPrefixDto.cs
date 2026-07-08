using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.IpPrefixes
{
    public class IpPrefixDto
    {
        public int Id { get; set; }
        public string Prefix { get; set; } = null!;
        public string? SubnetMask { get; set; }
        public string? Gateway { get; set; }
        public string? PreferredDns { get; set; }
        public string? AlternateDns { get; set; }
        public string? Description { get; set; }
        public int IpAddressCount { get; set; }
    }
}
