using Asset.Application.Dtos.DeviceGroups;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceGroupService
    {
        Task<PagedResponse<DeviceGroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword, int? departmentId = null);
        Task<List<DeviceGroupDto>> GetAllActiveAsync(int? departmentId = null);
        Task<DeviceGroupDto> GetByIdAsync(int id);
        Task<DeviceGroupDto> CreateAsync(CreateDeviceGroupDto request);
        Task UpdateAsync(UpdateDeviceGroupDto request);
        Task DeleteAsync(int id);
    }
}
