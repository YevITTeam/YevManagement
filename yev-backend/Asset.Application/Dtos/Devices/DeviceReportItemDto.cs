namespace Asset.Application.Dtos.Devices
{
    public class DeviceReportItemDto
    {
        public int Stt { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public string? IpAddress { get; set; }
        public DateTime PurchaseDate { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public bool IsExpired { get; set; }
        public int? FinancialPeriod { get; set; }
        public string? Note { get; set; }
    }
}
