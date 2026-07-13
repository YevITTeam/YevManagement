using Asset.Application.Dtos.Devices;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceService
    {
        Task<PagedResponse<DeviceGridDto>> GetDevicesForGridAsync(DeviceFilterRequest request);
        Task<List<DeviceGridDto>> GetAvailableForTransferAsync(string? keyword);
        Task<DeviceReplacementSuggestionDto?> GetReplacementSuggestionAsync(int oldDeviceId);
        Task<List<DeviceReportItemDto>> GetReportListAsync(DeviceReportFilterRequest request);
        Task<DeviceDto> GetByIdAsync(int id);
        Task<DeviceDetailDto> GetDetailAsync(int id);
        Task<DeviceDto> CreateAsync(CreateDeviceDto request);
        Task UpdateAsync(UpdateDeviceDto request);
        Task DeleteAsync(int id);
        Task<BulkDeleteDeviceResultDto> BulkDeleteAsync(List<int> ids);
    }
}
