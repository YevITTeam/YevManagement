using Asset.Application.Dtos.DeviceConfigurationImports;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceConfigurationImportService
    {
        Task<DeviceConfigurationImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string? fileName = null);
        Task<DeviceConfigurationImportConfirmResultDto> ConfirmAsync(ConfirmDeviceConfigurationImportDto request);

        // Reparses the Tanium file independently of Preview/Confirm and lists InUse devices missing from it.
        // deviceCodePrefixes limits which DeviceCodes are reconciled; null/empty = all InUse devices.
        Task<List<DeviceMissingInTaniumDto>> GetMissingDevicesAsync(Stream excelFileStream, string? fileName = null, IEnumerable<string>? deviceCodePrefixes = null);

        Task<DeviceMissingInTaniumReportDto> BuildMissingDevicesReportAsync(Stream excelFileStream, string? fileName = null, IEnumerable<string>? deviceCodePrefixes = null);
    }
}
