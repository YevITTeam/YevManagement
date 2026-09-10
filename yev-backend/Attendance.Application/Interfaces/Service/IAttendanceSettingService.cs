using Attendance.Application.Dtos.AttendanceSettings;

namespace Attendance.Application.Interfaces.Service
{
    public interface IAttendanceSettingService
    {
        Task<AttendanceSettingDto> GetAsync();

        Task<AttendanceSettingDto> UpdateAsync(UpdateAttendanceSettingDto request);

        // Dùng nội bộ bởi OtFormBatchBackgroundService — giờ chạy gom "Đơn tổng" hằng ngày.
        Task<TimeOnly> GetBatchAutoSendTimeAsync();

        // Gửi 1 email mẫu để Admin tự kiểm tra cấu hình SMTP + hiển thị đúng font/layout trên máy thật
        // (2026-09-05, theo yêu cầu người dùng) — trả về false thay vì throw nếu gửi thất bại, đúng hợp
        // đồng IEmailService.SendAsync, để Controller tự quyết định thông báo lỗi phù hợp.
        Task<bool> SendTestEmailAsync(SendTestEmailDto request, string senderDisplayName);
    }
}
