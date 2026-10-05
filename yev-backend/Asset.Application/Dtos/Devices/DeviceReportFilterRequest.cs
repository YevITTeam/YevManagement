namespace Asset.Application.Dtos.Devices
{
    public class DeviceReportFilterRequest
    {
        // Null or empty = no device type filter; otherwise matches any of the listed types.
        public List<int>? DeviceTypeIds { get; set; }
        public int? BranchId { get; set; }
        public int? DepartmentId { get; set; }
        public int? GroupId { get; set; }
        // PendingUse (0) or InUse (1); null = both. Other statuses never appear in this report.
        public int? Status { get; set; }
        public string? Keyword { get; set; }
    }
}
