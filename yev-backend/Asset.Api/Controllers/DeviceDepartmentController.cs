using Asset.Application.Dtos.DeviceDepartments;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class DeviceDepartmentController : BaseController
    {
        private readonly IDeviceDepartmentService _deviceDepartmentService;

        public DeviceDepartmentController(IDeviceDepartmentService deviceDepartmentService)
        {
            _deviceDepartmentService = deviceDepartmentService;
        }

        [RequirePermission("Asset.DeviceDepartment.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<DeviceDepartmentDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _deviceDepartmentService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceDepartment.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<DeviceDepartmentDto>>>> GetAllActive()
        {
            var result = await _deviceDepartmentService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.DeviceDepartment.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<DeviceDepartmentDto>>> GetById(int id)
        {
            var result = await _deviceDepartmentService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceDepartment.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDeviceDepartmentDto request)
        {
            var result = await _deviceDepartmentService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm bộ phận thành công.");
        }

        [RequirePermission("Asset.DeviceDepartment.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateDeviceDepartmentDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _deviceDepartmentService.UpdateAsync(request);
            return Success(true, "Cập nhật bộ phận thành công.");
        }

        [RequirePermission("Asset.DeviceDepartment.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _deviceDepartmentService.DeleteAsync(id);
            return Success(true, "Xóa bộ phận thành công.");
        }
    }
}
