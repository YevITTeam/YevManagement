namespace Asset.Application.Dtos.DeviceImports
{
    public class DeviceImportConfirmResultDto
    {
        public int CreatedCount { get; set; }
        public List<int> CreatedDeviceIds { get; set; } = new();

        // Number of Devices just created that also got a DeviceConfiguration (Excel row had
        // at least 1 of the 5 columns Maker/Model/CPU/RAM/Hard Drive, 2026-07-11).
        public int CreatedConfigCount { get; set; }

        // List of suggestions "old device will be transferred to the newly created device"
        // taken from the Old MQL column. Import no longer auto-transfers devices (2026-07-11)
        // — it only creates the Device and returns this suggestion so the FE can pre-fill
        // (but still editable) on the "Transfer Device" screen; the user must click "Transfer"
        // for each row for POST /api/TransferHistory to actually be called.
        public List<DeviceImportPendingTransferDto> PendingTransfers { get; set; } = new();

        // Rows still having a validation error at Confirm time are skipped, no longer blocking
        // the whole batch (2026-07-11, changed — previously any error row meant nothing was
        // saved at all). Valid rows are still created normally; error rows are listed here
        // with the reason for the FE to report back.
        public int SkippedCount { get; set; }
        public List<DeviceImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
