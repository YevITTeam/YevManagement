namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class DeviceConfigurationImportPreviewResultDto
    {
        public List<DeviceConfigurationImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        // Number of rows whose Computer Name doesn't match any of the 5 code families to
        // import (YDC/YLC/YDF/AC/TYC — the DA family is excluded entirely) — those rows are
        // dropped from Rows and are not counted as errors.
        public int OutOfScopeSkippedCount { get; set; }
    }
}
