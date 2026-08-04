using Attendance.Application.Dtos.AttendanceSettings;

namespace Attendance.Application.Interfaces.Service
{
    public interface IAttendanceSettingService
    {
        Task<AttendanceSettingDto> GetAsync();

        Task<AttendanceSettingDto> UpdateAsync(UpdateAttendanceSettingDto request);

        // Dùng nội bộ bởi OtFormService (tính IsEligibleForMeal) — trả thẳng entity đã đảm bảo tồn tại.
        Task<decimal> GetMainMealTicketMinHoursAsync();
    }
}
