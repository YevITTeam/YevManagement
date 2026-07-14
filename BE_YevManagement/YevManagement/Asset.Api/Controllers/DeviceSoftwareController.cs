using Asset.Application.Dtos.DeviceSoftwares;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Api.Controllers
{
    public class DeviceSoftwareController : BaseController
    {
        private readonly IDeviceSoftwareService _deviceSoftwareService;

        public DeviceSoftwareController(IDeviceSoftwareService deviceSoftwareService)
        {
            _deviceSoftwareService = deviceSoftwareService;
        }

        [RequirePermission("Asset.DeviceSoftware.View")]
        [HttpGet("device/{deviceId}")]
        public async Task<ActionResult<ApiResponse<List<DeviceSoftwareDto>>>> GetByDeviceId(int deviceId)
        {
            var result = await _deviceSoftwareService.GetByDeviceIdAsync(deviceId);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceSoftware.Create")]
        [HttpPost]
        public async Task<ActionResult<ApiResponse<DeviceSoftwareDto>>> Create([FromBody] CreateDeviceSoftwareDto request)
        {
            var result = await _deviceSoftwareService.CreateAsync(request);
            return Success(result, "Thêm phần mềm cho thiết bị thành công.");
        }

        [RequirePermission("Asset.DeviceSoftware.Update")]
        [HttpPut]
        public async Task<ActionResult<ApiResponse<bool>>> Update([FromBody] UpdateDeviceSoftwareDto request)
        {
            await _deviceSoftwareService.UpdateAsync(request);
            return Success(true, "Cập nhật thông tin cài đặt thành công.");
        }

        [RequirePermission("Asset.DeviceSoftware.Delete")]
        [HttpDelete("device/{deviceId}/software/{softwareId}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int deviceId, int softwareId)
        {
            await _deviceSoftwareService.DeleteAsync(deviceId, softwareId);
            return Success(true, "Gỡ phần mềm khỏi thiết bị thành công.");
        }

        [RequirePermission("Asset.DeviceSoftware.View")]
        [HttpGet("picker/{deviceId}")]
        public async Task<ActionResult<ApiResponse<List<SoftwarePickerDto>>>> GetPicker(int deviceId)
        {
            var result = await _deviceSoftwareService.GetPickerListAsync(deviceId);
            return Success(result);
        }

        [RequirePermission("Asset.DeviceSoftware.Update")]
        [HttpPut("sync")]
        public async Task<ActionResult<ApiResponse<List<DeviceSoftwareDto>>>> Sync([FromBody] SyncDeviceSoftwareDto request)
        {
            var result = await _deviceSoftwareService.SyncAsync(request);
            return Success(result, "Cập nhật phần mềm cho thiết bị thành công.");
        }
    }
}
