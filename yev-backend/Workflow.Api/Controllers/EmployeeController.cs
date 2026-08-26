using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.EmployeeOrgUnits;
using Workflow.Application.Dtos.Employees;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    public class EmployeeController : WorkflowBaseController
    {
        private readonly IEmployeeService _employeeService;

        public EmployeeController(IEmployeeService employeeService)
        {
            _employeeService = employeeService;
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<EmployeeDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _employeeService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<EmployeeDto>>> GetById(int id)
        {
            var result = await _employeeService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateEmployeeDto request)
        {
            var result = await _employeeService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhân sự thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateEmployeeDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _employeeService.UpdateAsync(request);
            return Success(true, "Cập nhật nhân sự thành công.");
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _employeeService.DeleteAsync(id);
            return Success(true, "Xóa nhân sự thành công.");
        }

        [RequirePermission("Workflow.Organization.View")]
        [HttpGet("{id}/org-units")]
        public async Task<ActionResult<ApiResponse<List<EmployeeOrgUnitDto>>>> GetOrgUnits(int id)
        {
            var result = await _employeeService.GetOrgUnitsAsync(id);
            return Success(result);
        }

        [RequirePermission("Workflow.Organization.Manage")]
        [HttpPut("{id}/org-units")]
        public async Task<ActionResult<ApiResponse<List<EmployeeOrgUnitDto>>>> ReplaceOrgUnits(int id, [FromBody] ReplaceEmployeeOrgUnitsDto request)
        {
            var result = await _employeeService.ReplaceOrgUnitsAsync(id, request);
            return Success(result, "Cập nhật đơn vị/chức danh kiêm nhiệm thành công.");
        }
    }
}
