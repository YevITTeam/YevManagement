using Asset.Application.Dtos.Suplliers;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    [AllowAnonymous]
    public class SupplierController : BaseController
    {
        private readonly ISupplierService _supplierService;

        public SupplierController(ISupplierService supplierService)
        {
            _supplierService = supplierService;
        }

        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<SupplierDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _supplierService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<SupplierDto>>>> GetAllActive()
        {
            var result = await _supplierService.GetAllActiveAsync();
            return Success(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<SupplierDto>>> GetById(int id)
        {
            var result = await _supplierService.GetByIdAsync(id);
            return Success(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSupplierDto request)
        {
            var result = await _supplierService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhà cung cấp thành công.");
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateSupplierDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _supplierService.UpdateAsync(request);
            return Success(true, "Cập nhật nhà cung cấp thành công.");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _supplierService.DeleteAsync(id);
            return Success(true, "Xóa nhà cung cấp thành công.");
        }
    }
}