namespace Asset.Application.Dtos.Devices
{
    public class DeviceGridDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public string BranchName { get; set; } = null!;
        public string SupplierName { get; set; } = null!;
        public string DeviceTypeName { get; set; } = null!;
        public string? IpAddress { get; set; }
        public DateTime PurchaseDate { get; set; }
        public string Manager { get; set; } = null!;
        public DateTime? ExpirationDate { get; set; }
        public string? Note { get; set; }
        public string? Email { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public bool IsOutsourced { get; set; }
        public string? SerialNumber { get; set; }
        public bool IsUseUsb { get; set; }
    }
}
