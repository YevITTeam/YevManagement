using Attendance.Application.Dtos.Departments;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IDepartmentService
    {
        Task<PagedResponse<DepartmentDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<DepartmentDto>> GetAllActiveAsync();
        Task<DepartmentDto> GetByIdAsync(int id);
        Task<DepartmentDto> CreateAsync(CreateDepartmentDto request);
        Task UpdateAsync(UpdateDepartmentDto request);
        Task DeleteAsync(int id);
    }
}
