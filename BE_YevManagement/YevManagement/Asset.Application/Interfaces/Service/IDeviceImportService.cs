using Asset.Application.Dtos.DeviceImports;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceImportService
    {
        Task<DeviceImportPreviewResultDto> PreviewAsync(Stream excelFileStream);
        Task<DeviceImportConfirmResultDto> ConfirmAsync(ConfirmDeviceImportDto request);
    }
}
