namespace Asset.Application.Dtos.Devices
{
    // Thống kê cho màn "Báo cáo thiết bị" (yev-frontend DeviceReport.tsx) — tính sẵn ở SQL
    // (COUNT/GROUP BY) thay vì trả nguyên bảng Device để FE tự cộng dồn (2026-07-30, xem
    // docs/docs-be/asset-module.md).
    public class DeviceReportSummaryDto
    {
        // Chỉ tính thiết bị PendingUse/InUse (không tính Chờ thanh lý/Đã thanh lý), giống GetReportListAsync.
        public int TotalCount { get; set; }
        public int InUseCount { get; set; }
        public int PendingUseCount { get; set; }
        // Số thiết bị trong ExpiringDevices có DaysRemaining >= 0 (chưa quá hạn, còn trong cửa sổ cảnh báo).
        public int ExpiringSoonCount { get; set; }
        public List<DeviceReportDistributionItemDto> BranchDistribution { get; set; } = new();
        public List<DeviceReportDistributionItemDto> DeviceTypeDistribution { get; set; } = new();
        // Toàn bộ thiết bị hết hạn trong vòng ExpiryWindowDays hoặc đã quá hạn (DaysRemaining có thể âm).
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
