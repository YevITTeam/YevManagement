using Asset.Application.Dtos.Softwares;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class SoftwareController : BaseController
    {
        private readonly ISoftwareService _softwareService;

        public SoftwareController(ISoftwareService softwareService)
        {
            _softwareService = softwareService;
        }

        [RequirePermission("Asset.Software.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<SoftwareDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _softwareService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.Software.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<SoftwareDto>>>> GetAllActive()
        {
            var result = await _softwareService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.Software.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<SoftwareDto>>> GetById(int id)
        {
            var result = await _softwareService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.Software.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSoftwareDto request)
        {
            var result = await _softwareService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm phần mềm thành công.");
        }

        [RequirePermission("Asset.Software.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateSoftwareDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _softwareService.UpdateAsync(request);
            return Success(true, "Cập nhật phần mềm thành công.");
        }

        [RequirePermission("Asset.Software.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _softwareService.DeleteAsync(id);
            return Success(true, "Xóa phần mềm thành công.");
        }
    }
}
