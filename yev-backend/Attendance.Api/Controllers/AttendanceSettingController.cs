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
    }
}
