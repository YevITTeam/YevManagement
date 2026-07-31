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

        // Thống kê cho màn "Báo cáo thiết bị" (KPI + phân bổ trạng thái/chi nhánh/loại + sắp hết hạn) —
        // tách riêng khỏi device-list vì đây là số liệu tổng hợp, không phải danh sách chi tiết để xuất Excel.
        [RequirePermission("Asset.Report.View")]
        [HttpGet("device-summary")]
        public async Task<ActionResult<ApiResponse<DeviceReportSummaryDto>>> GetDeviceSummary()
        {
            var result = await _deviceService.GetReportSummaryAsync();
            return Success(result, "Lấy thống kê báo cáo thiết bị thành công.");
        }
    }
}
