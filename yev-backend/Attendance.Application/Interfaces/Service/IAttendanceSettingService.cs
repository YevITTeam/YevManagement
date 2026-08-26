using Attendance.Application.Dtos.AttendanceSettings;

namespace Attendance.Application.Interfaces.Service
{
    public interface IAttendanceSettingService
    {
        Task<AttendanceSettingDto> GetAsync();

        Task<AttendanceSettingDto> UpdateAsync(UpdateAttendanceSettingDto request);

        // Dùng nội bộ bởi OtFormBatchBackgroundService — giờ chạy gom "Đơn tổng" hằng ngày.
        Task<TimeOnly> GetBatchAutoSendTimeAsync();
    }
}
