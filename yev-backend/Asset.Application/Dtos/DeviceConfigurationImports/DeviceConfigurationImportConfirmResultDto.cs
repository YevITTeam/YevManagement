namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class DeviceConfigurationImportConfirmResultDto
    {
        public int CreatedConfigCount { get; set; }
        public int UpdatedConfigCount { get; set; }
        public int IpReassignedCount { get; set; }
        // Devices whose SerialNumber was written from the "Computer Serial Number" column (2026-07-23).
        public int SerialUpdatedCount { get; set; }
        public List<int> UpdatedDeviceIds { get; set; } = new();
    }
}
