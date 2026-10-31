using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using System.Collections.Generic;

namespace Asset.Api.Controllers
{
    public class ReportController : BaseController
    {
        private readonly IDeviceService _deviceService;
        public ReportController(IDeviceService deviceService)
        {
            _deviceService = deviceService;
        }

        [RequirePermission("Asset.Report.View")]
        [HttpGet("device-list")]
        public async Task<ActionResult<ApiResponse<List<DeviceReportItemDto>>>> GetDeviceList(
            [FromQuery] DeviceReportFilterRequest request)
        {
            var result = await _deviceService.GetReportListAsync(request);
            return Success(result, "Lấy danh sách báo cáo thiết bị thành công.");
        }

        // Returns an .xlsx file, not ApiResponse<T> (same reason as ServerCheckController.ExportReport).
        [RequirePermission("Asset.Report.View")]
        [HttpGet("device-list/export")]
        public async Task<IActionResult> ExportDeviceList([FromQuery] DeviceReportFilterRequest request, [FromQuery] string? title)
        {
            var (content, fileName) = await _deviceService.ExportReportListAsync(request, title);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        // Aggregated stats, separate from device-list which returns raw rows for Excel export.
        [RequirePermission("Asset.Report.View")]
        [HttpGet("device-summary")]
        public async Task<ActionResult<ApiResponse<DeviceReportSummaryDto>>> GetDeviceSummary()
        {
            var result = await _deviceService.GetReportSummaryAsync();
            return Success(result, "Lấy thống kê báo cáo thiết bị thành công.");
        }
    }
}
