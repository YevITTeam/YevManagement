using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Dtos.Reports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // OT reports over completed forms; Excel endpoints return the .xlsx directly, not ApiResponse<T>.
    public class ProductionOtReportController : BaseController
    {
        private const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        private readonly IProductionOtReportService _productionOtReportService;

        public ProductionOtReportController(IProductionOtReportService productionOtReportService)
        {
            _productionOtReportService = productionOtReportService;
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("ticket-report")]
        public async Task<ActionResult<ApiResponse<ProductionTicketReportDto>>> GetTicketReport([FromQuery] ReportFilterDto filter)
            => Success(await _productionOtReportService.GetTicketReportAsync(filter));

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("hours-report-excel")]
        public async Task<IActionResult> ExportHoursReport([FromQuery] ReportFilterDto filter)
        {
            var (content, fileName) = await _productionOtReportService.ExportHoursReportAsync(filter);
            return File(content, XlsxType, fileName);
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("times-report-excel")]
        public async Task<IActionResult> ExportTimesReport([FromQuery] ReportFilterDto filter)
        {
            var (content, fileName) = await _productionOtReportService.ExportTimesReportAsync(filter);
            return File(content, XlsxType, fileName);
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("qry-export-excel")]
        public async Task<IActionResult> ExportQryExportExcel([FromQuery] ReportFilterDto filter)
        {
            var (content, fileName) = await _productionOtReportService.ExportQryExportExcelAsync(filter);
            return File(content, XlsxType, fileName);
        }

        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("sum-export-data")]
        public async Task<IActionResult> ExportSumExportData([FromQuery] ReportFilterDto filter)
        {
            var (content, fileName) = await _productionOtReportService.ExportSumExportDataAsync(filter);
            return File(content, XlsxType, fileName);
        }

        // Own route so report viewers without Attendance.Group.View can still pick groups.
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("groups")]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<ProductionOptionDto>>>> GetGroups([FromQuery] int? workshopId, [FromQuery] int? departmentId)
            => Success(await _productionOtReportService.GetGroupsAsync(workshopId, departmentId));

        // Employee rows only; the FE loads signatures/reasons via GET /api/OtForm/{PrimaryOtFormId}.
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("ticket-batch")]
        public async Task<ActionResult<ApiResponse<List<ProductionTicketBatchGroupDto>>>> GetTicketBatch([FromQuery] ReportFilterDto filter)
            => Success(await _productionOtReportService.GetTicketBatchAsync(filter));
    }
}
