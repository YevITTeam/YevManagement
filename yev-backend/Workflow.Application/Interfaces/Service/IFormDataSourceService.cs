using Shared.Application.Wrapper;
using Workflow.Application.Dtos.FormDataSources;

namespace Workflow.Application.Interfaces.Service
{
    public interface IFormDataSourceService
    {
        Task<PagedResponse<FormDataSourceDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<FormDataSourceDto>> GetAllActiveAsync();
        Task<FormDataSourceDto> GetByIdAsync(int id);
        Task<FormDataSourceDto> CreateAsync(CreateFormDataSourceDto request);
        Task UpdateAsync(UpdateFormDataSourceDto request);
        Task DeleteAsync(int id);
    }
}
