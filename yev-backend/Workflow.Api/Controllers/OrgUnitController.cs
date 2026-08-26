using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.OrgUnits;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    public class OrgUnitController : WorkflowBaseController
    {
        private readonly IOrgUnitService _orgUnitService;

        public OrgUnitController(IOrgUnitService orgUnitService)
        {
            _orgUnitService = orgUnitService;
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OrgUnitDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _orgUnitService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("tree")]
        public async Task<ActionResult<ApiResponse<List<OrgUnitTreeDto>>>> GetTree()
        {
            var result = await _orgUnitService.GetTreeAsync();
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OrgUnitDto>>> GetById(int id)
        {
            var result = await _orgUnitService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOrgUnitDto request)
        {
            var result = await _orgUnitService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm đơn vị tổ chức thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateOrgUnitDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _orgUnitService.UpdateAsync(request);
            return Success(true, "Cập nhật đơn vị tổ chức thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _orgUnitService.DeleteAsync(id);
            return Success(true, "Xóa đơn vị tổ chức thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPut("reorder")]
        public async Task<ActionResult<ApiResponse<bool>>> Reorder([FromBody] ReorderOrgUnitDto request)
        {
            await _orgUnitService.ReorderAsync(request);
            return Success(true, "Sắp xếp lại cây tổ chức thành công.");
        }
    }
}
