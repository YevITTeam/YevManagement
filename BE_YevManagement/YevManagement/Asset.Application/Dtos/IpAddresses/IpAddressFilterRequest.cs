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
        public int? DeviceId { get; set; }
    }
}
