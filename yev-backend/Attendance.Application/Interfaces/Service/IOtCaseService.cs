using Attendance.Application.Dtos.OtCases;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IOtCaseService
    {
        Task<PagedResponse<OtCaseDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<OtCaseDto>> GetAllActiveAsync();
        Task<OtCaseDto> GetByIdAsync(int id);
        Task<OtCaseDto> CreateAsync(CreateOtCaseDto request);
        Task UpdateAsync(UpdateOtCaseDto request);
        Task DeleteAsync(int id);
    }
}
