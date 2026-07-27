namespace Asset.Application.Dtos.DeviceLiquidationImports
{
    public class DeviceLiquidationImportPreviewResultDto
    {
        public List<DeviceLiquidationImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
    }
}
