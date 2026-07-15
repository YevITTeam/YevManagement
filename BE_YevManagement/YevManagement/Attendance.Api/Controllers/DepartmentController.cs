using Attendance.Application.Dtos.Departments;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class DepartmentController : BaseController
    {
        private readonly IDepartmentService _departmentService;

        public DepartmentController(IDepartmentService departmentService)
        {
            _departmentService = departmentService;
        }

        [RequirePermission("Attendance.Department.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<DepartmentDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _departmentService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.Department.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<DepartmentDto>>>> GetAllActive()
        {
            var result = await _departmentService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.Department.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<DepartmentDto>>> GetById(int id)
        {
            var result = await _departmentService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Attendance.Department.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDepartmentDto request)
        {
            var result = await _departmentService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm bộ phận thành công.");
        }

        [RequirePermission("Attendance.Department.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateDepartmentDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _departmentService.UpdateAsync(request);
            return Success(true, "Cập nhật bộ phận thành công.");
        }

        [RequirePermission("Attendance.Department.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _departmentService.DeleteAsync(id);
            return Success(true, "Xóa bộ phận thành công.");
        }
    }
}
