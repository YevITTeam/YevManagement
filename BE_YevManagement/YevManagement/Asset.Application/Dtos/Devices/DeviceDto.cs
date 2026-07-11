using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Devices
{
    public class DeviceDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public int DeviceTypeId { get; set; }
        public string DeviceTypeName { get; set; } = null!;
        public int SupplierId { get; set; }
        public string SupplierName { get; set; } = null!;
        public int BranchId { get; set; }
        public string BranchName { get; set; } = null!;
        public string Manager { get; set; } = null!;
        public DateTime PurchaseDate { get; set; }
        public int DepreciationMonths { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public bool IsOutsourced { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public string? Note { get; set; }
        public string? SerialNumber { get; set; }
        public bool IsUseUsb { get; set; }
        public int? ReplacesOldDeviceId { get; set; }
        public string? ReplacesOldDeviceCode { get; set; }
        public List<DeviceIpAddressDto> IpAddresses { get; set; } = new();
        public List<DeviceEmailDto> Emails { get; set; } = new();
    }
}
