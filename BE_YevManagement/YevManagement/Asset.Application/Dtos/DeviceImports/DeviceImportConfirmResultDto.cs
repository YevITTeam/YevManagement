namespace Asset.Application.Dtos.DeviceImports
{
    public class DeviceImportConfirmResultDto
    {
        public int CreatedCount { get; set; }
        public int ReplacedOldDeviceCount { get; set; }
        public List<int> CreatedDeviceIds { get; set; } = new();
    }
}
