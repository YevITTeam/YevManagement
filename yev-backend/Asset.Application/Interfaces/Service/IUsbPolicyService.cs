using Asset.Application.Dtos.UsbLogs;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IUsbPolicyService
    {
        Task<UsbAgentSyncResponse> SyncAgentAsync(UsbAgentSyncRequest request);

        Task<PagedResponse<UsbDeviceDto>> GetDevicesPagedAsync(UsbDeviceFilterRequest filter);

        Task ApproveAsync(int usbDeviceId, UsbApprovalRequest request);

        Task RevokeAsync(int usbDeviceId);

        Task SetAliasAsync(int usbDeviceId, string? alias);

        Task SetMachineApprovalAsync(int usbDeviceId, int deviceId, bool approve);

        Task<List<UsbMachineOptionDto>> GetMachineOptionsAsync();
        Task<UsbOwnerOptionsDto> GetOwnerOptionsAsync();

        Task<UsbPolicySettingDto> GetSettingAsync();

        Task<UsbPolicySettingDto> UpdateSettingAsync(UsbPolicySettingDto request);

        Task<PagedResponse<UsbAgentDto>> GetAgentsPagedAsync(UsbAgentFilterRequest filter);
        Task<byte[]> ExportAgentsAsync(UsbAgentFilterRequest filter);

        Task<byte[]> ExportDevicesAsync(UsbDeviceFilterRequest filter);

        Task<List<UsbAgentEventDto>> GetAgentEventsAsync(string machineName);

        Task DeleteAgentAsync(int id);

        Task<int> PurgeAgentsAsync(UsbAgentPurgeRequest request);

        Task<UsbStatsDto> GetStatsAsync();

        Task<UsbAgentSettingDto> GetAgentSettingAsync();

        Task<UsbAgentSettingDto> UpdateAgentSettingAsync(UsbAgentSettingRequest request);

        Task SetUninstallPasswordAsync(string? password);

        Task<List<UsbAgentReleaseDto>> GetReleasesAsync();

        Task<UsbAgentReleaseDto> UploadReleaseAsync(Stream content, string fileName, string signingKeyXml, string? note);

        Task DeleteReleaseAsync(int id);

        Task<string?> GetReleaseFilePathAsync(string version);
    }
}
