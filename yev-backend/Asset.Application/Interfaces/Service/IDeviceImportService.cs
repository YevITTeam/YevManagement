using Asset.Application.Dtos.DeviceImports;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceImportService
    {
        Task<DeviceImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null);
        Task<DeviceImportConfirmResultDto> ConfirmAsync(ConfirmDeviceImportDto request);
    }
}
