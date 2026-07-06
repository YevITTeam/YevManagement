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
    }
}
