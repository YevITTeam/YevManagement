using Shared.Application.Wrapper;
using Workflow.Application.Dtos.FormCategories;
using Workflow.Application.Dtos.FormCategoryCoordinators;

namespace Workflow.Application.Interfaces.Service
{
    public interface IFormCategoryService
    {
        Task<PagedResponse<FormCategoryDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<FormCategoryDto>> GetAllActiveAsync();
        Task<FormCategoryDto> GetByIdAsync(int id);
        Task<FormCategoryDto> CreateAsync(CreateFormCategoryDto request);
        Task UpdateAsync(UpdateFormCategoryDto request);
        Task DeleteAsync(int id);

        Task<List<FormCategoryCoordinatorDto>> GetCoordinatorsAsync(int formCategoryId);
        Task<List<FormCategoryCoordinatorDto>> ReplaceCoordinatorsAsync(int formCategoryId, ReplaceFormCategoryCoordinatorsDto request);
    }
}
