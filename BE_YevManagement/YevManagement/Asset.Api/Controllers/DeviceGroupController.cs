using Asset.Application.Dtos.DeviceGroups;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class DeviceGroupController : BaseController
    {
        private readonly IDeviceGroupService _deviceGroupService;

        public DeviceGroupController(IDeviceGroupService deviceGroupService)
        {
            _deviceGroupService = deviceGroupService;
        }

        [RequirePermission("Asset.DeviceGroup.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<DeviceGroupDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _deviceGroupService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceGroup.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<DeviceGroupDto>>>> GetAllActive()
        {
            var result = await _deviceGroupService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.DeviceGroup.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<DeviceGroupDto>>> GetById(int id)
        {
            var result = await _deviceGroupService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceGroup.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDeviceGroupDto request)
        {
            var result = await _deviceGroupService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhóm thành công.");
        }

        [RequirePermission("Asset.DeviceGroup.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateDeviceGroupDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _deviceGroupService.UpdateAsync(request);
            return Success(true, "Cập nhật nhóm thành công.");
        }

        [RequirePermission("Asset.DeviceGroup.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _deviceGroupService.DeleteAsync(id);
            return Success(true, "Xóa nhóm thành công.");
        }
    }
}
