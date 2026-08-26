using Shared.Application.Wrapper;
using Workflow.Application.Dtos.FormAccesses;
using Workflow.Application.Dtos.FormDefinitions;
using Workflow.Application.Dtos.FormFieldConditions;
using Workflow.Application.Dtos.FormFields;
using Workflow.Application.Dtos.FormRoutes;

namespace Workflow.Application.Interfaces.Service
{
    public interface IFormDefinitionService
    {
        Task<PagedResponse<FormDefinitionDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<FormDefinitionDto> GetByIdAsync(int id);
        Task<FormDefinitionDto> CreateAsync(CreateFormDefinitionDto request, int? currentUserId);
        Task UpdateAsync(UpdateFormDefinitionDto request, int? currentUserId);
        Task DeleteAsync(int id);

        Task<List<FormFieldDto>> GetFieldsAsync(int formDefinitionId);
        Task<List<FormFieldDto>> ReplaceFieldsAsync(int formDefinitionId, ReplaceFormFieldsDto request);

        Task<List<FormFieldConditionDto>> GetConditionsAsync(int formDefinitionId);
        Task<List<FormFieldConditionDto>> ReplaceConditionsAsync(int formDefinitionId, ReplaceFormFieldConditionsDto request);

        Task<List<FormAccessDto>> GetAccessesAsync(int formDefinitionId);
        Task<List<FormAccessDto>> ReplaceAccessesAsync(int formDefinitionId, ReplaceFormAccessesDto request);

        Task<FormDefinitionDto> PublishAsync(int formDefinitionId, int? currentUserId);
        Task<FormDefinitionDto> CloneAsync(int formDefinitionId, CloneFormDefinitionDto request, int? currentUserId);

        Task<List<FormRouteDto>> GetRoutesAsync(int formDefinitionId);
        Task<ReplaceFormRoutesResultDto> ReplaceRoutesAsync(int formDefinitionId, ReplaceFormRoutesDto request);
    }
}
