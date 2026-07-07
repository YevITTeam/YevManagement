using Asset.Application.Dtos.DeviceSoftwares;
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
    public class DeviceSoftwareController : BaseController
    {
        private readonly IDeviceSoftwareService _deviceSoftwareService;

        public DeviceSoftwareController(IDeviceSoftwareService deviceSoftwareService)
        {
            _deviceSoftwareService = deviceSoftwareService;
        }

        [HttpGet("device/{deviceId}")]
        public async Task<ActionResult<ApiResponse<List<DeviceSoftwareDto>>>> GetByDeviceId(int deviceId)
        {
            var result = await _deviceSoftwareService.GetByDeviceIdAsync(deviceId);
            return Success(result);
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<DeviceSoftwareDto>>> Create([FromBody] CreateDeviceSoftwareDto request)
        {
            var result = await _deviceSoftwareService.CreateAsync(request);
            return Success(result, "Thêm phần mềm cho thiết bị thành công.");
        }

        [HttpPut]
        public async Task<ActionResult<ApiResponse<bool>>> Update([FromBody] UpdateDeviceSoftwareDto request)
        {
            await _deviceSoftwareService.UpdateAsync(request);
            return Success(true, "Cập nhật thông tin cài đặt thành công.");
        }

        [HttpDelete("device/{deviceId}/software/{softwareId}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int deviceId, int softwareId)
        {
            await _deviceSoftwareService.DeleteAsync(deviceId, softwareId);
            return Success(true, "Gỡ phần mềm khỏi thiết bị thành công.");
        }
    }
}
