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

        // View mở cho MỌI tài khoản đăng nhập (không gắn [RequirePermission]) — màn Tạo đơn của Trưởng
        // nhóm/Nhân viên cần đọc cấu hình để tự tính phiếu ăn và tô đỏ lũy kế vượt ngưỡng, trong khi
        // quyền SỬA cấu hình vẫn chỉ Admin. Cùng cách EmployeeController/adjust-accumulation đã làm.
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

        // Cùng quyền với sửa cấu hình — đây là công cụ kiểm tra SMTP/hiển thị email, không phải cấu hình
        // nghiệp vụ, nhưng vẫn chỉ nên để đúng người đang quản trị "Cài đặt" dùng (2026-09-05).
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
