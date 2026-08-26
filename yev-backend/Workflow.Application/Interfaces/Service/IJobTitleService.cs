using Shared.Application.Wrapper;
using Workflow.Application.Dtos.JobTitles;

namespace Workflow.Application.Interfaces.Service
{
    public interface IJobTitleService
    {
        Task<PagedResponse<JobTitleDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<JobTitleDto>> GetAllActiveAsync();
        Task<JobTitleDto> GetByIdAsync(int id);
        Task<JobTitleDto> CreateAsync(CreateJobTitleDto request);
        Task UpdateAsync(UpdateJobTitleDto request);
        Task DeleteAsync(int id);
    }
}
