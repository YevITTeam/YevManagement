namespace Asset.Application.Dtos.DeviceLiquidationImports
{
    // 1 row parsed from the liquidation import file — a single "Mã máy" (MQL) column (2026-07-23).
    // Used both as the Preview response (server fills ResolvedDeviceId/CurrentStatus/IsValid/Errors)
    // and the Confirm request (client resends the raw DeviceCode; server re-resolves it, never trusts
    // a client-supplied Id). A device can only be liquidated from the "Chờ thanh lý" (PendingLiquidation)
    // state — any other state makes the row invalid.
    public class DeviceLiquidationImportRowDto
    {
        public int RowNumber { get; set; }

        public string? DeviceCode { get; set; }

        public int? ResolvedDeviceId { get; set; }

        // Current status + its display text, echoed back so the FE can show why a row was rejected
        // (e.g. "đang Đang sử dụng") without another lookup.
        public int? CurrentStatus { get; set; }
        public string? CurrentStatusText { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
