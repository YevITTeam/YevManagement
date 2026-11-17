using Attendance.Application.Dtos.WorkCalendars;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Per-workshop non-working-day calendar. Reads are open to any signed-in user (the OT form screen needs them
    // to pick TH1/TH2 automatically); writes reuse the settings permission, same as AttendanceSetting.
    public class WorkCalendarController : BaseController
    {
        private const string ExcelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        private readonly IWorkCalendarService _workCalendarService;

        public WorkCalendarController(IWorkCalendarService workCalendarService)
        {
            _workCalendarService = workCalendarService;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<WorkCalendarDayDto>>>> GetByYear([FromQuery] int? workshopId, [FromQuery] string? workshopCode, [FromQuery] int year)
        {
            // By code for screens whose users cannot list workshops (ServerCheck reads Di An's calendar).
            var id = workshopId ?? await _workCalendarService.GetWorkshopIdByCodeAsync(workshopCode ?? string.Empty);
            var result = await _workCalendarService.GetByYearAsync(id, year);
            return Success(result);
        }

        [HttpGet("template")]
        public async Task<IActionResult> DownloadTemplate([FromQuery] int workshopId, [FromQuery] int year)
        {
            var (content, fileName) = await _workCalendarService.BuildTemplateAsync(workshopId, year);
            return File(content, ExcelContentType, fileName);
        }

        [RequirePermission("Attendance.Setting.Update")]
        [HttpPost("import")]
        public async Task<ActionResult<ApiResponse<WorkCalendarImportResultDto>>> Import(IFormFile file, [FromQuery] int workshopId, [FromQuery] int year)
        {
            if (file == null || file.Length == 0)
                return Fail<WorkCalendarImportResultDto>("Vui lòng chọn file Excel để import.");

            await using var stream = file.OpenReadStream();
            var result = await _workCalendarService.ImportAsync(workshopId, year, stream);
            return Success(result, $"Đã import {result.ImportedCount} ngày nghỉ của năm {result.Year}.");
        }

        [RequirePermission("Attendance.Setting.Update")]
        [HttpPut("day")]
        public async Task<ActionResult<ApiResponse<bool>>> SaveDay([FromBody] SaveWorkCalendarDayDto request)
        {
            await _workCalendarService.SaveDayAsync(request);
            return Success(true, "Đã lưu ngày.");
        }
    }
}
