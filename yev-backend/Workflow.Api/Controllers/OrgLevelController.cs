using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.OrgLevels;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    public class OrgLevelController : WorkflowBaseController
    {
        private readonly IOrgLevelService _orgLevelService;

        public OrgLevelController(IOrgLevelService orgLevelService)
        {
            _orgLevelService = orgLevelService;
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OrgLevelDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _orgLevelService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<OrgLevelDto>>>> GetAllActive()
        {
            var result = await _orgLevelService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OrgLevelDto>>> GetById(int id)
        {
            var result = await _orgLevelService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOrgLevelDto request)
        {
            var result = await _orgLevelService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm cấp tổ chức thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateOrgLevelDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _orgLevelService.UpdateAsync(request);
            return Success(true, "Cập nhật cấp tổ chức thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _orgLevelService.DeleteAsync(id);
            return Success(true, "Xóa cấp tổ chức thành công.");
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("{id}/job-title-suggestions")]
        public async Task<ActionResult<ApiResponse<List<OrgLevelJobTitleSuggestionDto>>>> GetJobTitleSuggestions(int id)
        {
            var result = await _orgLevelService.GetJobTitleSuggestionsAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPut("{id}/job-title-suggestions")]
        public async Task<ActionResult<ApiResponse<List<OrgLevelJobTitleSuggestionDto>>>> ReplaceJobTitleSuggestions(int id, [FromBody] ReplaceOrgLevelJobTitleSuggestionsDto request)
        {
            var result = await _orgLevelService.ReplaceJobTitleSuggestionsAsync(id, request);
            return Success(result, "Cập nhật chức danh gợi ý thành công.");
        }
    }
}
