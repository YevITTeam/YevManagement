using System.Collections.Generic;

namespace Asset.Application.Dtos.IpAddresses
{
    // Shaped for the AI Chat tool get_ip_prefix_usage (docs/docs-be/asset-module.md §1.18) — not the
    // grid/detail pages, which already have IpAddressDto for that.
    public class IpPrefixUsageDto
    {
        public string Prefix { get; set; } = null!;
        public int TotalIpCount { get; set; }
        public int UsedCount { get; set; }
        public int AvailableCount { get; set; }
        public List<IpAddressUsageItemDto> UsedIpAddresses { get; set; } = new();
        public List<string> AvailableIpAddresses { get; set; } = new();
    }

    public class IpAddressUsageItemDto
    {
        public string IpAddress { get; set; } = null!;
        public string StatusText { get; set; } = null!;
        // "Khác" when assigned outside the system (AssignedExternal, no DeviceId); the real device
        // code when Assigned; never present for Available rows (those go to AvailableIpAddresses).
        public string? DeviceCode { get; set; }
    }
}
