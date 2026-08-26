using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.JobTitles;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    public class JobTitleController : WorkflowBaseController
    {
        private readonly IJobTitleService _jobTitleService;

        public JobTitleController(IJobTitleService jobTitleService)
        {
            _jobTitleService = jobTitleService;
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<JobTitleDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _jobTitleService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<JobTitleDto>>>> GetAllActive()
        {
            var result = await _jobTitleService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<JobTitleDto>>> GetById(int id)
        {
            var result = await _jobTitleService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateJobTitleDto request)
        {
            var result = await _jobTitleService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm chức danh thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateJobTitleDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _jobTitleService.UpdateAsync(request);
            return Success(true, "Cập nhật chức danh thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _jobTitleService.DeleteAsync(id);
            return Success(true, "Xóa chức danh thành công.");
        }
    }
}
