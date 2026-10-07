using Attendance.Application.Dtos.Reports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // 2 báo cáo theo ngày cho đơn "dưới chuyền" đã Hoàn tất — xem docs/docs-be/attendance-module.md §Báo cáo & export dưới chuyền theo ngày.
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

        // 2 export mới (2026-09-03c) — độc lập với 2 export ở trên, tên file theo đúng quy tắc thật
        // (xem ProductionOtReportService.BuildRealFileNameAsync).
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("qry-export-excel")]
        public async Task<IActionResult> ExportQryExportExcel([FromQuery] DateOnly date, [FromQuery] int? departmentId)
        {
            var (content, fileName) = await _productionOtReportService.ExportQryExportExcelAsync(date, departmentId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("sum-export-data")]
        public async Task<IActionResult> ExportSumExportData([FromQuery] DateOnly date, [FromQuery] int? departmentId)
        {
            var (content, fileName) = await _productionOtReportService.ExportSumExportDataAsync(date, departmentId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        // Dữ liệu nền cho phiếu YEV-22-024 xuất hàng loạt — FE tự gọi GET /api/OtForm/{PrimaryOtFormId}
        // cho phần chữ ký/lý do, chỉ lấy danh sách nhân viên gộp từ đây (2026-09-03c).
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("ticket-batch")]
        public async Task<ActionResult<ApiResponse<List<ProductionTicketBatchGroupDto>>>> GetTicketBatch([FromQuery] DateOnly date, [FromQuery] int? departmentId)
        {
            var result = await _productionOtReportService.GetTicketBatchAsync(date, departmentId);
            return Success(result);
        }
    }
}
