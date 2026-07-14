using Asset.Application.Dtos.DeviceConfigurations;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class DeviceConfigurationController : BaseController
    {
        private readonly IDeviceConfigurationService _deviceConfigurationService;

        public DeviceConfigurationController(IDeviceConfigurationService deviceConfigurationService)
        {
            _deviceConfigurationService = deviceConfigurationService;
        }

        [RequirePermission("Asset.DeviceConfiguration.View")]
        [HttpGet("by-device/{deviceId}")]
        public async Task<ActionResult<ApiResponse<DeviceConfigurationDto?>>> GetByDeviceId(int deviceId)
        {
            var result = await _deviceConfigurationService.GetByDeviceIdAsync(deviceId);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceConfiguration.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDeviceConfigurationDto request)
        {
            var result = await _deviceConfigurationService.CreateAsync(request);
            return CreatedSuccess(nameof(GetByDeviceId), new { deviceId = result.DeviceId }, result, "Thêm cấu hình thiết bị thành công.");
        }

        [RequirePermission("Asset.DeviceConfiguration.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateDeviceConfigurationDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _deviceConfigurationService.UpdateAsync(request);
            return Success(true, "Cập nhật cấu hình thiết bị thành công.");
        }

        [RequirePermission("Asset.DeviceConfiguration.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _deviceConfigurationService.DeleteAsync(id);
            return Success(true, "Xóa cấu hình thiết bị thành công.");
        }

        [RequirePermission("Asset.DeviceConfiguration.View")]
        [HttpGet("{configId}/initial")]
        public async Task<ActionResult<ApiResponse<DeviceConfigurationInitialDto?>>> GetInitial(int configId)
        {
            var result = await _deviceConfigurationService.GetInitialByConfigIdAsync(configId);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceConfiguration.Delete")]
        [HttpDelete("initial/{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteInitial(int id)
        {
            await _deviceConfigurationService.DeleteInitialAsync(id);
            return Success(true, "Xóa cấu hình ban đầu thành công.");
        }

        [RequirePermission("Asset.DeviceConfiguration.View")]
        [HttpGet("{configId}/history")]
        public async Task<ActionResult<ApiResponse<List<DeviceConfigurationHistoryDto>>>> GetHistory(int configId)
        {
            var result = await _deviceConfigurationService.GetHistoryAsync(configId);
            return Success(result);
        }
    }
}
