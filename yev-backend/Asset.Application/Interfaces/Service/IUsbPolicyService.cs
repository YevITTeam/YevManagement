using Asset.Application.Dtos.UsbLogs;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IUsbPolicyService
    {
        Task<UsbAgentSyncResponse> SyncAgentAsync(UsbAgentSyncRequest request);

        Task<PagedResponse<UsbDeviceDto>> GetDevicesPagedAsync(UsbDeviceFilterRequest filter);

        Task SetApprovalAsync(int usbDeviceId, bool approve, string? note);

        Task<UsbPolicySettingDto> GetSettingAsync();

        Task<UsbPolicySettingDto> UpdateSettingAsync(UsbPolicySettingDto request);

        Task<PagedResponse<UsbAgentDto>> GetAgentsPagedAsync(UsbAgentFilterRequest filter);
    }
}
