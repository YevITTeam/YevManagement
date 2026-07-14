namespace Asset.Application.Dtos.Devices
{
    public class DeviceReportFilterRequest
    {
        public int? DeviceTypeId { get; set; }
        public int? BranchId { get; set; }
        public string? Keyword { get; set; }
    }
}
