using Asset.Application.Dtos.Devices;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceService
    {
        Task<PagedResponse<DeviceGridDto>> GetDevicesForGridAsync(DeviceFilterRequest request);
    }
}
