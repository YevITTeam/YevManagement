using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Devices
{
    public class DeviceFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;

        public string? DeviceCode { get; set; }
        public string? Manager { get; set; }
        public string? PurchaseDate { get; set; }
        public string? IpAddress { get; set; }
        public string? SupplierName { get; set; }
        public string? Note { get; set; }
        public bool? IsOutsourced { get; set; }
        public string? SerialNumber { get; set; }
        public bool? IsUseUsb { get; set; }

        // 2026-07-10: sort theo DeviceCode, null = giữ mặc định OrderByDescending(PurchaseDate).
        // true = tăng dần, false = giảm dần.
        public bool? SortDeviceCodeAscending { get; set; }
    }
}
