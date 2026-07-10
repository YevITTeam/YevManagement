namespace Asset.Application.Dtos.DeviceImports
{
    public class DeviceImportPreviewResultDto
    {
        public List<DeviceImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
    }
}
