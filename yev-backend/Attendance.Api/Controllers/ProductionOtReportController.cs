using Attendance.Application.Dtos.Reports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // 2 báo cáo theo ngày cho đơn "dưới chuyền" đã Hoàn tất — xem docs/Note_OT.txt mục 1 dòng 10 và
    // mục 2, chốt thiết kế với người dùng 2026-08-28.
    public class ProductionOtReportController : BaseController
    {
        private readonly IProductionOtReportService _productionOtReportService;

        public ProductionOtReportController(IProductionOtReportService productionOtReportService)
        {
            _productionOtReportService = productionOtReportService;
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("ticket-report")]
        public async Task<ActionResult<ApiResponse<ProductionTicketReportDto>>> GetTicketReport([FromQuery] DateOnly date, [FromQuery] int? departmentId)
        {
            var result = await _productionOtReportService.GetTicketReportAsync(date, departmentId);
            return Success(result);
        }

        // Trả file .xlsx trực tiếp, KHÔNG bọc ApiResponse<T> — cùng pattern
        // ProductionEmployeeExportController.Export.
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("hours-report-excel")]
        public async Task<IActionResult> ExportHoursReport([FromQuery] DateOnly date, [FromQuery] int? departmentId)
        {
            var (content, fileName) = await _productionOtReportService.ExportHoursReportAsync(date, departmentId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("times-report-excel")]
        public async Task<IActionResult> ExportTimesReport([FromQuery] DateOnly date, [FromQuery] int? departmentId)
        {
            var (content, fileName) = await _productionOtReportService.ExportTimesReportAsync(date, departmentId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
