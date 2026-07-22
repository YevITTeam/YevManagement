namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class DeviceConfigurationImportPreviewResultDto
    {
        public List<DeviceConfigurationImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        // Number of rows whose Computer Name doesn't match any of the 6 code families to
        // import (YDC/YLC/YDF/AC/DA/TYC) — excluded from Rows, not counted as an error.
        public int OutOfScopeSkippedCount { get; set; }
    }
}
