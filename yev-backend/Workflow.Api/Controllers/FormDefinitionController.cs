using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.FormAccesses;
using Workflow.Application.Dtos.FormDefinitions;
using Workflow.Application.Dtos.FormFieldConditions;
using Workflow.Application.Dtos.FormFields;
using Workflow.Application.Dtos.FormRoutes;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    public class FormDefinitionController : WorkflowBaseController
    {
        private readonly IFormDefinitionService _formDefinitionService;

        public FormDefinitionController(IFormDefinitionService formDefinitionService)
        {
            _formDefinitionService = formDefinitionService;
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<FormDefinitionDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _formDefinitionService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<FormDefinitionDto>>> GetById(int id)
        {
            var result = await _formDefinitionService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateFormDefinitionDto request)
        {
            var result = await _formDefinitionService.CreateAsync(request, CurrentUserId);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateFormDefinitionDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _formDefinitionService.UpdateAsync(request, CurrentUserId);
            return Success(true, "Cập nhật form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _formDefinitionService.DeleteAsync(id);
            return Success(true, "Xóa form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("{id}/fields")]
        public async Task<ActionResult<ApiResponse<List<FormFieldDto>>>> GetFields(int id)
        {
            var result = await _formDefinitionService.GetFieldsAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}/fields")]
        public async Task<ActionResult<ApiResponse<List<FormFieldDto>>>> ReplaceFields(int id, [FromBody] ReplaceFormFieldsDto request)
        {
            var result = await _formDefinitionService.ReplaceFieldsAsync(id, request);
            return Success(result, "Cập nhật ô nhập thành công.");
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}/layout")]
        public async Task<ActionResult<ApiResponse<FormDefinitionDto>>> UpdateLayout(int id, [FromBody] UpdateFormDefinitionLayoutDto request)
        {
            var result = await _formDefinitionService.UpdateLayoutAsync(id, request, CurrentUserId);
            return Success(result, "Cập nhật layout thành công.");
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("{id}/conditions")]
        public async Task<ActionResult<ApiResponse<List<FormFieldConditionDto>>>> GetConditions(int id)
        {
            var result = await _formDefinitionService.GetConditionsAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}/conditions")]
        public async Task<ActionResult<ApiResponse<List<FormFieldConditionDto>>>> ReplaceConditions(int id, [FromBody] ReplaceFormFieldConditionsDto request)
        {
            var result = await _formDefinitionService.ReplaceConditionsAsync(id, request);
            return Success(result, "Cập nhật điều kiện hiển thị thành công.");
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("{id}/accesses")]
        public async Task<ActionResult<ApiResponse<List<FormAccessDto>>>> GetAccesses(int id)
        {
            var result = await _formDefinitionService.GetAccessesAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}/accesses")]
        public async Task<ActionResult<ApiResponse<List<FormAccessDto>>>> ReplaceAccesses(int id, [FromBody] ReplaceFormAccessesDto request)
        {
            var result = await _formDefinitionService.ReplaceAccessesAsync(id, request);
            return Success(result, "Cập nhật quyền tạo đơn thành công.");
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPost("{id}/publish")]
        public async Task<ActionResult<ApiResponse<FormDefinitionDto>>> Publish(int id)
        {
            var result = await _formDefinitionService.PublishAsync(id, CurrentUserId);
            return Success(result, "Publish form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPost("{id}/clone")]
        public async Task<ActionResult<ApiResponse<FormDefinitionDto>>> Clone(int id, [FromBody] CloneFormDefinitionDto request)
        {
            var result = await _formDefinitionService.CloneAsync(id, request, CurrentUserId);
            return Success(result, "Nhân bản form thành công.");
        }

        [RequirePermission("Workflow.FormDesign.View")]
        [HttpGet("{id}/routes")]
        public async Task<ActionResult<ApiResponse<List<FormRouteDto>>>> GetRoutes(int id)
        {
            var result = await _formDefinitionService.GetRoutesAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.FormDesign.Manage")]
        [HttpPut("{id}/routes")]
        public async Task<ActionResult<ApiResponse<List<FormRouteDto>>>> ReplaceRoutes(int id, [FromBody] ReplaceFormRoutesDto request)
        {
            var result = await _formDefinitionService.ReplaceRoutesAsync(id, request);
            var message = result.Warning is null ? "Cập nhật luồng duyệt thành công." : $"Cập nhật luồng duyệt thành công. {result.Warning}";
            return Success(result.Routes, message);
        }
    }
}
