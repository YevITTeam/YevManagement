using Attendance.Application.Dtos.Reports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Daily reports for completed production-line OT forms.
    public class ProductionOtReportController : BaseController
    {
        private readonly IProductionOtReportService _productionOtReportService;

        public ProductionOtReportController(IProductionOtReportService productionOtReportService)
        {
            _productionOtReportService = productionOtReportService;
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("ticket-report")]
        public async Task<ActionResult<ApiResponse<ProductionTicketReportDto>>> GetTicketReport([FromQuery] DateOnly date, [FromQuery] int? departmentId, [FromQuery] int? workshopId = null)
        {
            var result = await _productionOtReportService.GetTicketReportAsync(date, departmentId, workshopId);
            return Success(result);
        }

        // Returns the .xlsx directly, not ApiResponse<T>.
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("hours-report-excel")]
        public async Task<IActionResult> ExportHoursReport([FromQuery] DateOnly date, [FromQuery] int? departmentId, [FromQuery] int? workshopId = null)
        {
            var (content, fileName) = await _productionOtReportService.ExportHoursReportAsync(date, departmentId, workshopId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("times-report-excel")]
        public async Task<IActionResult> ExportTimesReport([FromQuery] DateOnly date, [FromQuery] int? departmentId, [FromQuery] int? workshopId = null)
        {
            var (content, fileName) = await _productionOtReportService.ExportTimesReportAsync(date, departmentId, workshopId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        // File names follow the real naming rule (ProductionOtReportService.BuildRealFileNameAsync).
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("qry-export-excel")]
        public async Task<IActionResult> ExportQryExportExcel([FromQuery] DateOnly date, [FromQuery] int? departmentId, [FromQuery] int? workshopId = null)
        {
            var (content, fileName) = await _productionOtReportService.ExportQryExportExcelAsync(date, departmentId, workshopId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("sum-export-data")]
        public async Task<IActionResult> ExportSumExportData([FromQuery] DateOnly date, [FromQuery] int? departmentId, [FromQuery] int? workshopId = null)
        {
            var (content, fileName) = await _productionOtReportService.ExportSumExportDataAsync(date, departmentId, workshopId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        // Employee rows only; the FE loads signatures/reasons via GET /api/OtForm/{PrimaryOtFormId}.
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("ticket-batch")]
        public async Task<ActionResult<ApiResponse<List<ProductionTicketBatchGroupDto>>>> GetTicketBatch([FromQuery] DateOnly date, [FromQuery] int? departmentId, [FromQuery] int? workshopId = null)
        {
            var result = await _productionOtReportService.GetTicketBatchAsync(date, departmentId, workshopId);
            return Success(result);
        }
    }
}
