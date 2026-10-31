using Attendance.Application.Dtos.AttendanceSettings;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class AttendanceSettingController : BaseController
    {
        private readonly IAttendanceSettingService _attendanceSettingService;

        public AttendanceSettingController(IAttendanceSettingService attendanceSettingService)
        {
            _attendanceSettingService = attendanceSettingService;
        }

        // No [RequirePermission]: OT form creators need settings to compute meal tickets and limit warnings; editing stays Admin-only.
        [HttpGet]
        public async Task<ActionResult<ApiResponse<AttendanceSettingDto>>> Get()
        {
            var result = await _attendanceSettingService.GetAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.Setting.Update")]
        [HttpPut]
        public async Task<ActionResult<ApiResponse<AttendanceSettingDto>>> Update([FromBody] UpdateAttendanceSettingDto request)
        {
            var result = await _attendanceSettingService.UpdateAsync(request);
            return Success(result, "Cập nhật cấu hình thành công.");
        }

        // Diagnostic tool, but limited to whoever manages Settings.
        [RequirePermission("Attendance.Setting.Update")]
        [HttpPost("test-email")]
        public async Task<ActionResult<ApiResponse<bool>>> SendTestEmail([FromBody] SendTestEmailDto request)
        {
            var sent = await _attendanceSettingService.SendTestEmailAsync(request, CurrentFullName ?? CurrentUserName);
            return sent
                ? Success(true, "Đã gửi email kiểm tra.")
                : Fail<bool>("Gửi email thất bại — kiểm tra lại cấu hình SMTP (EmailSettings trong appsettings.json).");
        }
    }
}
