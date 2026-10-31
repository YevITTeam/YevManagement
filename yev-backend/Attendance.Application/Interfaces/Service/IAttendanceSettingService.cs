using Attendance.Application.Dtos.AttendanceSettings;

namespace Attendance.Application.Interfaces.Service
{
    public interface IAttendanceSettingService
    {
        Task<AttendanceSettingDto> GetAsync();

        Task<AttendanceSettingDto> UpdateAsync(UpdateAttendanceSettingDto request);

        // Daily auto-send time for OtFormBatchBackgroundService.
        Task<TimeOnly> GetBatchAutoSendTimeAsync();

        // Returns false instead of throwing, matching IEmailService.SendAsync, so the controller picks the message.
        Task<bool> SendTestEmailAsync(SendTestEmailDto request, string senderDisplayName);
    }
}
