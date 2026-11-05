using Attendance.Application.Dtos.AuditTrails;
using Shared.Application.Interfaces;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    // Every Attendance mail goes through here so it lands in AttendanceMailLogs; never throws.
    public interface IAttendanceMailLogService
    {
        // Returns the log id once queued, null when the mail could not be queued.
        Task<long?> SendAsync(string? recipientUserName, string toEmail, string subject, string htmlBody, IReadOnlyList<MailAttachment>? attachments = null);

        // The recipient has no email address, so nothing was queued.
        Task LogSkippedAsync(string recipientUserName, string subject);

        Task<PagedResponse<AttendanceMailLogDto>> GetPagedAsync(AttendanceMailLogFilterRequest request);
    }
}
