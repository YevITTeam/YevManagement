namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class DeviceConfigurationImportConfirmResultDto
    {
        public int CreatedConfigCount { get; set; }
        public int UpdatedConfigCount { get; set; }
        public int IpReassignedCount { get; set; }
        public List<int> UpdatedDeviceIds { get; set; } = new();
    }
}
