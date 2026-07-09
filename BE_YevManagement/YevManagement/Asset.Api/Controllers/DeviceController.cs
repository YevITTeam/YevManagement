using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Api.Controllers
{
    [AllowAnonymous]
    public class DeviceController : BaseController
    {
        private readonly IDeviceService _deviceService;
        public DeviceController(IDeviceService deviceService)
        {
            _deviceService = deviceService;
        }

        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<DeviceGridDto>>>> GetDevicesGrid(
            [FromQuery] DeviceFilterRequest request)
        {
            var result = await _deviceService.GetDevicesForGridAsync(request);

            return Success(result, "Lấy danh sách thiết bị thành công.");
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<DeviceDto>>> GetById(int id)
        {
            var result = await _deviceService.GetByIdAsync(id);
            return Success(result);
        }

        [HttpGet("{id}/detail")]
        public async Task<ActionResult<ApiResponse<DeviceDetailDto>>> GetDetail(int id)
        {
            var result = await _deviceService.GetDetailAsync(id);
            return Success(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDeviceDto request)
        {
            var result = await _deviceService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm thiết bị thành công.");
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateDeviceDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _deviceService.UpdateAsync(request);
            return Success(true, "Cập nhật thiết bị thành công.");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _deviceService.DeleteAsync(id);
            return Success(true, "Xóa thiết bị thành công.");
        }
    }
}
