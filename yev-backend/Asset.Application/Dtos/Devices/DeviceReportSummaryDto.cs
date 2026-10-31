namespace Asset.Application.Dtos.Devices
{
    // Computed in SQL (COUNT/GROUP BY) instead of shipping the whole Device table for the FE to aggregate.
    public class DeviceReportSummaryDto
    {
        // Only PendingUse/InUse devices, consistent with GetReportListAsync.
        public int TotalCount { get; set; }
        public int InUseCount { get; set; }
        public int PendingUseCount { get; set; }
        // Devices in ExpiringDevices with DaysRemaining >= 0 (not yet expired).
        public int ExpiringSoonCount { get; set; }
        public List<DeviceReportDistributionItemDto> BranchDistribution { get; set; } = new();
        public List<DeviceReportDistributionItemDto> DeviceTypeDistribution { get; set; } = new();
        // Expiring within ExpiryWindowDays or already expired (DaysRemaining may be negative).
        public List<DeviceReportExpiringItemDto> ExpiringDevices { get; set; } = new();
    }

    public class DeviceReportDistributionItemDto
    {
        public string Label { get; set; } = null!;
        public int Count { get; set; }
    }

    public class DeviceReportExpiringItemDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public string BranchName { get; set; } = null!;
        public string Manager { get; set; } = null!;
        public DateTime? ExpirationDate { get; set; }
        public int DaysRemaining { get; set; }
    }
}
