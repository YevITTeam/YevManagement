using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Api.Controllers
{
    public class DeviceController : BaseController
    {
        private readonly IDeviceService _deviceService;
        public DeviceController(IDeviceService deviceService)
        {
            _deviceService = deviceService;
        }

        [RequirePermission("Asset.Device.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<DeviceGridDto>>>> GetDevicesGrid(
            [FromQuery] DeviceFilterRequest request)
        {
            var result = await _deviceService.GetDevicesForGridAsync(request);

            return Success(result, "Lấy danh sách thiết bị thành công.");
        }

        [RequirePermission("Asset.Device.View")]
        [HttpGet("available")]
        public async Task<ActionResult<ApiResponse<List<DeviceGridDto>>>> GetAvailableForTransfer([FromQuery] string? keyword)
        {
            var result = await _deviceService.GetAvailableForTransferAsync(keyword);
            return Success(result, "Lấy danh sách thiết bị chờ sử dụng thành công.");
        }

        [RequirePermission("Asset.Device.View")]
        [HttpGet("{id}/replacement-suggestion")]
        public async Task<ActionResult<ApiResponse<DeviceReplacementSuggestionDto?>>> GetReplacementSuggestion(int id)
        {
            var result = await _deviceService.GetReplacementSuggestionAsync(id);
            return Success(result, result != null ? "Có gợi ý máy thay thế." : "Không có gợi ý máy thay thế.");
        }

        [RequirePermission("Asset.Device.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<DeviceDto>>> GetById(int id)
        {
            var result = await _deviceService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.Device.View")]
        [HttpGet("{id}/detail")]
        public async Task<ActionResult<ApiResponse<DeviceDetailDto>>> GetDetail(int id)
        {
            var result = await _deviceService.GetDetailAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.Device.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDeviceDto request)
        {
            var result = await _deviceService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm thiết bị thành công.");
        }

        [RequirePermission("Asset.Device.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateDeviceDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _deviceService.UpdateAsync(request);
            return Success(true, "Cập nhật thiết bị thành công.");
        }

        [RequirePermission("Asset.Device.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _deviceService.DeleteAsync(id);
            return Success(true, "Xóa thiết bị thành công.");
        }
    }
}
