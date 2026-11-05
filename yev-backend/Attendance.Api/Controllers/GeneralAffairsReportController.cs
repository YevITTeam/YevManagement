using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // OT data of completed office forms for General Affairs.
    public class GeneralAffairsReportController : BaseController
    {
        private readonly IGeneralAffairsReportService _generalAffairsReportService;

        public GeneralAffairsReportController(IGeneralAffairsReportService generalAffairsReportService)
        {
            _generalAffairsReportService = generalAffairsReportService;
        }

        // Returns the .xlsx directly, not ApiResponse<T>.
        [RequirePermission("Attendance.ProductionOtReport.View")]
        [HttpGet("excel")]
        public async Task<IActionResult> ExportExcel([FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate, [FromQuery] int? workshopId, [FromQuery] int? departmentId)
        {
            var (content, fileName) = await _generalAffairsReportService.ExportExcelAsync(fromDate, toDate, workshopId, departmentId);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.Setting.Update")]
        [HttpPost("send-now")]
        public async Task<ActionResult<ApiResponse<int>>> SendNow()
        {
            var sent = await _generalAffairsReportService.SendPendingAsync();
            return Success(sent, sent == 0 ? "Không có dữ liệu mới cần gửi." : $"Đã gửi {sent} mail cho Tổng vụ.");
        }
    }
}
