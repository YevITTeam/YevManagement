using Asset.Application.Dtos.Devices;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceService
    {
        Task<PagedResponse<DeviceGridDto>> GetDevicesForGridAsync(DeviceFilterRequest request);
        Task<DeviceDto> GetByIdAsync(int id);
        Task<DeviceDetailDto> GetDetailAsync(int id);
        Task<DeviceDto> CreateAsync(CreateDeviceDto request);
        Task UpdateAsync(UpdateDeviceDto request);
        Task DeleteAsync(int id);
    }
}
