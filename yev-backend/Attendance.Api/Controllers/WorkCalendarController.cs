using Attendance.Application.Dtos.WorkCalendars;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Non-working-day calendar. Read endpoints are open to any signed-in user (the OT form screen needs them
    // to pick TH1/TH2 automatically); import reuses the settings permission, same as AttendanceSetting.
    public class WorkCalendarController : BaseController
    {
        private const string ExcelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        private readonly IWorkCalendarService _workCalendarService;

        public WorkCalendarController(IWorkCalendarService workCalendarService)
        {
            _workCalendarService = workCalendarService;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<WorkCalendarDayDto>>>> GetByYear([FromQuery] int year)
        {
            var result = await _workCalendarService.GetByYearAsync(year);
            return Success(result);
        }

        [HttpGet("template")]
        public async Task<IActionResult> DownloadTemplate([FromQuery] int year)
        {
            var content = await _workCalendarService.BuildTemplateAsync(year);
            return File(content, ExcelContentType, $"LichNghi_{year}.xlsx");
        }

        [RequirePermission("Attendance.Setting.Update")]
        [HttpPost("import")]
        public async Task<ActionResult<ApiResponse<WorkCalendarImportResultDto>>> Import(IFormFile file, [FromQuery] int year)
        {
            if (file == null || file.Length == 0)
                return Fail<WorkCalendarImportResultDto>("Vui lòng chọn file Excel để import.");

            await using var stream = file.OpenReadStream();
            var result = await _workCalendarService.ImportAsync(year, stream);
            return Success(result, $"Đã import {result.ImportedCount} ngày nghỉ của năm {result.Year}.");
        }
    }
}
