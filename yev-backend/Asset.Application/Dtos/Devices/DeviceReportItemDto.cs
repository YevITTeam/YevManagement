namespace Asset.Application.Dtos.Devices
{
    public class DeviceReportItemDto
    {
        public int Stt { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public string DeviceTypeName { get; set; } = null!;
        public string? SerialNumber { get; set; }
        public string? IpAddress { get; set; }
        public string? Email { get; set; }
        public string Manager { get; set; } = null!;
        public string BranchName { get; set; } = null!;
        public string? DepartmentName { get; set; }
        public string? GroupName { get; set; }
        public string SupplierName { get; set; } = null!;
        public DateTime PurchaseDate { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public bool IsExpired { get; set; }
        public int? FinancialPeriod { get; set; }
    }
}
