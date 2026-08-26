using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.FormDataSources;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    public class FormDataSourceController : WorkflowBaseController
    {
        private readonly IFormDataSourceService _formDataSourceService;

        public FormDataSourceController(IFormDataSourceService formDataSourceService)
        {
            _formDataSourceService = formDataSourceService;
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<FormDataSourceDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _formDataSourceService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<FormDataSourceDto>>>> GetAllActive()
        {
            var result = await _formDataSourceService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<FormDataSourceDto>>> GetById(int id)
        {
            var result = await _formDataSourceService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateFormDataSourceDto request)
        {
            var result = await _formDataSourceService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nguồn dữ liệu thành công.");
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateFormDataSourceDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _formDataSourceService.UpdateAsync(request);
            return Success(true, "Cập nhật nguồn dữ liệu thành công.");
        }

        [RequirePermission("Workflow.Setting.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _formDataSourceService.DeleteAsync(id);
            return Success(true, "Xóa nguồn dữ liệu thành công.");
        }
    }
}
