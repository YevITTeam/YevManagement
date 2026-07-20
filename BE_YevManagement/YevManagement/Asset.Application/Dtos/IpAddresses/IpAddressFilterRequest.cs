using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.IpAddresses
{
    public class IpAddressFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;

        public string? Keyword { get; set; }
        public int? Status { get; set; }

        // Filter by usage level (2026-07-11): true = IP in use (Status != Available),
        // false = IP unused (Status == Available), null = no filter. This is a combined
        // filter of Status (in use / unused) for the FE, used either independently or
        // together with Status.
        public bool? IsInUse { get; set; }

        public int? DeviceId { get; set; }
    }
}
