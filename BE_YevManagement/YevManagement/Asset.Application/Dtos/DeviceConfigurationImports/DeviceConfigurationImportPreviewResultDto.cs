namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class DeviceConfigurationImportPreviewResultDto
    {
        public List<DeviceConfigurationImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        // Số dòng có Computer Name không khớp 6 họ mã cần import (YDC/YLC/YDF/AC/DA/TYC)
        // — bị loại khỏi Rows, không tính là lỗi.
        public int OutOfScopeSkippedCount { get; set; }
    }
}
