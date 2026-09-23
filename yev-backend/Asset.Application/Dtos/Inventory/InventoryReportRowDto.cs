using System;
using System.Collections.Generic;

namespace Asset.Application.Dtos.Inventory
{
    // 1 dòng = 1 phiên kiểm kê (khác ServerCheckReportRowDto: không gộp theo ngày/loại thiết bị, vì
    // kiểm kê không phải hằng ngày — mỗi phiên đã tự đại diện cho 1 đợt của 1 xưởng).
    public class InventoryReportRowDto
    {
        public int SessionId { get; set; }
        public int BranchId { get; set; }
        public string? BranchName { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public int TotalCount { get; set; }
        public int FoundCount { get; set; }
        public int MissingCount { get; set; }
        public List<InventoryMissingItemDto> MissingItems { get; set; } = new();
        public string? CheckedBy { get; set; }
    }

    public class InventoryMissingItemDto
    {
        public string DeviceCode { get; set; } = null!;
        public string DeviceName { get; set; } = null!;
        public string? Note { get; set; }
    }
}
