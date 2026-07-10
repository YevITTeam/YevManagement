using Asset.Application.Dtos.DeviceConfigurationImports;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceConfigurationImportService
    {
        Task<DeviceConfigurationImportPreviewResultDto> PreviewAsync(Stream excelFileStream);
        Task<DeviceConfigurationImportConfirmResultDto> ConfirmAsync(ConfirmDeviceConfigurationImportDto request);
    }
}
