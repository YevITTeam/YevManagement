using Asset.Application.Dtos.DeviceLiquidationImports;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceLiquidationImportService
    {
        Task<DeviceLiquidationImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null);
        Task<DeviceLiquidationImportConfirmResultDto> ConfirmAsync(ConfirmDeviceLiquidationImportDto request);
    }
}
