namespace Asset.Application.Dtos.DeviceImports
{
    // 1 device replacement suggestion derived from the "Old MQL" column of the import row.
    // This is only a suggestion/pre-fill for the FE — it does not perform the device
    // transfer itself (see DeviceImportConfirmResultDto).
    public class DeviceImportPendingTransferDto
    {
        public int NewDeviceId { get; set; }
        public string NewDeviceCode { get; set; } = string.Empty;
        public int OldDeviceId { get; set; }
        public string OldDeviceCode { get; set; } = string.Empty;
    }
}
