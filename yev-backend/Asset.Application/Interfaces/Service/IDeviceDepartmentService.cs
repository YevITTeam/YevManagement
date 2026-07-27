using Asset.Application.Dtos.DeviceDepartments;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceDepartmentService
    {
        Task<PagedResponse<DeviceDepartmentDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<DeviceDepartmentDto>> GetAllActiveAsync();
        Task<DeviceDepartmentDto> GetByIdAsync(int id);
        Task<DeviceDepartmentDto> CreateAsync(CreateDeviceDepartmentDto request);
        Task UpdateAsync(UpdateDeviceDepartmentDto request);
        Task DeleteAsync(int id);
    }
}
