using Shared.Application.Wrapper;
using Workflow.Application.Dtos.OrgLevels;

namespace Workflow.Application.Interfaces.Service
{
    public interface IOrgLevelService
    {
        Task<PagedResponse<OrgLevelDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<OrgLevelDto>> GetAllActiveAsync();
        Task<OrgLevelDto> GetByIdAsync(int id);
        Task<OrgLevelDto> CreateAsync(CreateOrgLevelDto request);
        Task UpdateAsync(UpdateOrgLevelDto request);
        Task DeleteAsync(int id);
        Task<List<OrgLevelJobTitleSuggestionDto>> GetJobTitleSuggestionsAsync(int orgLevelId);
        Task<List<OrgLevelJobTitleSuggestionDto>> ReplaceJobTitleSuggestionsAsync(int orgLevelId, ReplaceOrgLevelJobTitleSuggestionsDto request);
    }
}
