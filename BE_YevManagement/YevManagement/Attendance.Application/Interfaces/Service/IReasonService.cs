using Attendance.Application.Dtos.Reasons;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IReasonService
    {
        Task<PagedResponse<ReasonDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<ReasonDto>> GetAllActiveAsync();
        Task<ReasonDto> GetByIdAsync(int id);
        Task<ReasonDto> CreateAsync(CreateReasonDto request);
        Task UpdateAsync(UpdateReasonDto request);
        Task DeleteAsync(int id);
    }
}
