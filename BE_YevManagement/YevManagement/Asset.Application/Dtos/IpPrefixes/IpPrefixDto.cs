using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.IpPrefixes
{
    public class IpPrefixDto
    {
        public int Id { get; set; }
        public string Prefix { get; set; } = null!;
        public int? BranchId { get; set; }
        public string? BranchName { get; set; }
        public string? SubnetMask { get; set; }
        public string? Gateway { get; set; }
        public string? PreferredDns { get; set; }
        public string? AlternateDns { get; set; }
        public string? Description { get; set; }

        // Removed the total "IP count" (always = 255 for every prefix since each range
        // generates a fixed 1..255). Replaced with the number of IPs in use (Status != Available)
        // and the number of unused IPs (Status == Available) in the range, so the FE can
        // display/filter ranges by usage level.
        public int UsedIpCount { get; set; }
        public int AvailableIpCount { get; set; }
    }
}
