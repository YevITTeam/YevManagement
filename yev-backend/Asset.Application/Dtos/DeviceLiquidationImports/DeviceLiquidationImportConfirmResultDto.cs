namespace Asset.Application.Dtos.DeviceLiquidationImports
{
    // 1 row skipped during Confirm (does not block the rest of the batch — same pattern as
    // DeviceImportConfirmResultDto.SkippedRows).
    public class DeviceLiquidationImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? DeviceCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    public class DeviceLiquidationImportConfirmResultDto
    {
        public int LiquidatedCount { get; set; }
        public List<int> LiquidatedDeviceIds { get; set; } = new();

        // How many IPs were freed / emails hidden as a side effect of liquidation (a liquidated device
        // is treated as no longer in use — same cleanup as deleting one).
        public int ReleasedIpCount { get; set; }

        public int SkippedCount { get; set; }
        public List<DeviceLiquidationImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
