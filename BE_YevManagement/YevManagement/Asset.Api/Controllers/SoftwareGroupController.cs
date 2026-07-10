using Asset.Application.Dtos.SoftwareGroups;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class SoftwareGroupController : BaseController
    {
        private readonly ISoftwareGroupService _softwareGroupService;

        public SoftwareGroupController(ISoftwareGroupService softwareGroupService)
        {
            _softwareGroupService = softwareGroupService;
        }

        [RequirePermission("Asset.SoftwareGroup.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<SoftwareGroupDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _softwareGroupService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.SoftwareGroup.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<SoftwareGroupDto>>>> GetAllActive()
        {
            var result = await _softwareGroupService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.SoftwareGroup.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<SoftwareGroupDto>>> GetById(int id)
        {
            var result = await _softwareGroupService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.SoftwareGroup.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSoftwareGroupDto request)
        {
            var result = await _softwareGroupService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhóm phần mềm thành công.");
        }

        [RequirePermission("Asset.SoftwareGroup.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateSoftwareGroupDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _softwareGroupService.UpdateAsync(request);
            return Success(true, "Cập nhật nhóm phần mềm thành công.");
        }

        [RequirePermission("Asset.SoftwareGroup.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _softwareGroupService.DeleteAsync(id);
            return Success(true, "Xóa nhóm phần mềm thành công.");
        }
    }
}
