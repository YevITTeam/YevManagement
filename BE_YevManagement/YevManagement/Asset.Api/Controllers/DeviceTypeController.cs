using Asset.Application.Dtos.DeviceTypes;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class DeviceTypeController : BaseController
    {
        private readonly IDeviceTypeService _deviceTypeService;

        public DeviceTypeController(IDeviceTypeService deviceTypeService)
        {
            _deviceTypeService = deviceTypeService;
        }

        [RequirePermission("Asset.DeviceType.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<DeviceTypeDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _deviceTypeService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceType.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<DeviceTypeDto>>>> GetAllActive()
        {
            var result = await _deviceTypeService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.DeviceType.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<DeviceTypeDto>>> GetById(int id)
        {
            var result = await _deviceTypeService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceType.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDeviceTypeDto request)
        {
            var result = await _deviceTypeService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm loại thiết bị thành công.");
        }

        [RequirePermission("Asset.DeviceType.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateDeviceTypeDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _deviceTypeService.UpdateAsync(request);
            return Success(true, "Cập nhật loại thiết bị thành công.");
        }

        [RequirePermission("Asset.DeviceType.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _deviceTypeService.DeleteAsync(id);
            return Success(true, "Xóa loại thiết bị thành công.");
        }
    }
}
