namespace Asset.Application.Dtos.DeviceLiquidationImports
{
    // Confirm request: the client resends the rows from Preview (only DeviceCode is actually used;
    // the server re-validates everything against the current DB state).
    public class ConfirmDeviceLiquidationImportDto
    {
        public List<DeviceLiquidationImportRowDto> Rows { get; set; } = new();
    }
}
