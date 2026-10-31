namespace Asset.Application.Dtos.DeviceLiquidationImports
{
    // Used as both Preview response and Confirm request; the server re-resolves DeviceCode and never trusts a client Id.
    // Only PendingLiquidation devices can be liquidated; any other state makes the row invalid.
    public class DeviceLiquidationImportRowDto
    {
        public int RowNumber { get; set; }

        public string? DeviceCode { get; set; }

        public int? ResolvedDeviceId { get; set; }

        // Echoed back so the FE can show why a row was rejected without another lookup.
        public int? CurrentStatus { get; set; }
        public string? CurrentStatusText { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
