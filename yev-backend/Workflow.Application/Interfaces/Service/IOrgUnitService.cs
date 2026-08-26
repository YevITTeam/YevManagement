using Shared.Application.Wrapper;
using Workflow.Application.Dtos.OrgUnits;

namespace Workflow.Application.Interfaces.Service
{
    public interface IOrgUnitService
    {
        Task<PagedResponse<OrgUnitDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<OrgUnitTreeDto>> GetTreeAsync();
        Task<OrgUnitDto> GetByIdAsync(int id);
        Task<OrgUnitDto> CreateAsync(CreateOrgUnitDto request);
        Task UpdateAsync(UpdateOrgUnitDto request);
        Task DeleteAsync(int id);
        Task ReorderAsync(ReorderOrgUnitDto request);
    }
}
