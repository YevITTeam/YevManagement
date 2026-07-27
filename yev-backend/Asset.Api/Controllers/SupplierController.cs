using Asset.Application.Dtos.Suplliers;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class SupplierController : BaseController
    {
        private readonly ISupplierService _supplierService;

        public SupplierController(ISupplierService supplierService)
        {
            _supplierService = supplierService;
        }

        [RequirePermission("Asset.Supplier.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<SupplierDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _supplierService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.Supplier.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<SupplierDto>>>> GetAllActive()
        {
            var result = await _supplierService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.Supplier.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<SupplierDto>>> GetById(int id)
        {
            var result = await _supplierService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.Supplier.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSupplierDto request)
        {
            var result = await _supplierService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhà cung cấp thành công.");
        }

        [RequirePermission("Asset.Supplier.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateSupplierDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _supplierService.UpdateAsync(request);
            return Success(true, "Cập nhật nhà cung cấp thành công.");
        }

        [RequirePermission("Asset.Supplier.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _supplierService.DeleteAsync(id);
            return Success(true, "Xóa nhà cung cấp thành công.");
        }
    }
}
