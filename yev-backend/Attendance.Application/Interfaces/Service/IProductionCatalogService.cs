using Attendance.Application.Dtos.ProductionCatalogs;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IProductionCatalogService
    {
        Task<PagedResponse<ProductionCatalogItemDto>> GetPagedAsync(ProductionCatalogKind kind, int pageIndex, int pageSize, string? keyword, int? teamId);
        Task CreateAsync(ProductionCatalogKind kind, SaveProductionCatalogItemDto request);
        Task UpdateAsync(ProductionCatalogKind kind, int id, SaveProductionCatalogItemDto request);
        Task DeleteAsync(ProductionCatalogKind kind, int id);
    }
}
