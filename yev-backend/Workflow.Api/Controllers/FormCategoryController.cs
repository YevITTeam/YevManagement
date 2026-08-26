using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.FormCategories;
using Workflow.Application.Dtos.FormCategoryCoordinators;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    public class FormCategoryController : WorkflowBaseController
    {
        private readonly IFormCategoryService _formCategoryService;

        public FormCategoryController(IFormCategoryService formCategoryService)
        {
            _formCategoryService = formCategoryService;
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<FormCategoryDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _formCategoryService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<FormCategoryDto>>>> GetAllActive()
        {
            var result = await _formCategoryService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<FormCategoryDto>>> GetById(int id)
        {
            var result = await _formCategoryService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateFormCategoryDto request)
        {
            var result = await _formCategoryService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm danh mục form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateFormCategoryDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _formCategoryService.UpdateAsync(request);
            return Success(true, "Cập nhật danh mục form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _formCategoryService.DeleteAsync(id);
            return Success(true, "Xóa danh mục form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("{id}/coordinators")]
        public async Task<ActionResult<ApiResponse<List<FormCategoryCoordinatorDto>>>> GetCoordinators(int id)
        {
            var result = await _formCategoryService.GetCoordinatorsAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}/coordinators")]
        public async Task<ActionResult<ApiResponse<List<FormCategoryCoordinatorDto>>>> ReplaceCoordinators(int id, [FromBody] ReplaceFormCategoryCoordinatorsDto request)
        {
            var result = await _formCategoryService.ReplaceCoordinatorsAsync(id, request);
            return Success(result, "Cập nhật người phụ trách thiết kế thành công.");
        }
    }
}
