using Attendance.Application.Dtos.AuditTrails;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IAttendanceAuditTrailService
    {
        Task<PagedResponse<AttendanceAuditTrailDto>> GetPagedAsync(AttendanceAuditTrailFilterRequest request);
    }
}
