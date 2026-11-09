using Attendance.Application.Dtos.ProductionCatalogs;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class ProductionCatalogController : BaseController
    {
        private const string ManagePermission = "Attendance.ProductionCatalog.Manage";
        private readonly IProductionCatalogService _service;

        public ProductionCatalogController(IProductionCatalogService service)
        {
            _service = service;
        }

        [RequirePermission(ManagePermission)]
        [HttpGet("{kind}/grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<ProductionCatalogItemDto>>>> GetPaged(
            ProductionCatalogKind kind, [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 10, [FromQuery] string? keyword = null, [FromQuery] int? teamId = null)
        {
            return Success(await _service.GetPagedAsync(kind, pageIndex, pageSize, keyword, teamId));
        }

        [RequirePermission(ManagePermission)]
        [HttpPost("{kind}")]
        public async Task<ActionResult<ApiResponse<bool>>> Create(ProductionCatalogKind kind, [FromBody] SaveProductionCatalogItemDto request)
        {
            await _service.CreateAsync(kind, request);
            return Success(true, "Thêm thành công.");
        }

        [RequirePermission(ManagePermission)]
        [HttpPut("{kind}/{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(ProductionCatalogKind kind, int id, [FromBody] SaveProductionCatalogItemDto request)
        {
            await _service.UpdateAsync(kind, id, request);
            return Success(true, "Cập nhật thành công.");
        }

        [RequirePermission(ManagePermission)]
        [HttpDelete("{kind}/{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(ProductionCatalogKind kind, int id)
        {
            await _service.DeleteAsync(kind, id);
            return Success(true, "Xóa thành công.");
        }
    }
}
