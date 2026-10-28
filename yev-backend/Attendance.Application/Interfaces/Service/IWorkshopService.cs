using Attendance.Application.Dtos.Workshops;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IWorkshopService
    {
        Task<PagedResponse<WorkshopDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<WorkshopDto>> GetAllActiveAsync();
        Task<WorkshopDto> GetByIdAsync(int id);
        Task<WorkshopDto> CreateAsync(CreateWorkshopDto request);
        Task UpdateAsync(UpdateWorkshopDto request);
        Task DeleteAsync(int id);
    }
}
