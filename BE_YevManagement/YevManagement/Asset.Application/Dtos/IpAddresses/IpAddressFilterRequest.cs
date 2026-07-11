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

        // Lọc theo mức độ sử dụng (2026-07-11): true = IP đang sử dụng (Status != Available),
        // false = IP chưa sử dụng (Status == Available), null = không lọc. Là dạng lọc gộp
        // của Status (đang/chưa dùng) cho FE, dùng độc lập hoặc kết hợp với Status.
        public bool? IsInUse { get; set; }

        public int? DeviceId { get; set; }
    }
}
