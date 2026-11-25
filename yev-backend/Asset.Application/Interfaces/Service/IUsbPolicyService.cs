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

        Task<UsbPolicySettingDto> GetSettingAsync();

        Task<UsbPolicySettingDto> UpdateSettingAsync(UsbPolicySettingDto request);

        Task<PagedResponse<UsbAgentDto>> GetAgentsPagedAsync(UsbAgentFilterRequest filter);
    }
}
