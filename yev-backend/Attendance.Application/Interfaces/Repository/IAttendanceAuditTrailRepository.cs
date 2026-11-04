using Attendance.Domain.Entities;
using Shared.Application.Abstractions;

namespace Attendance.Application.Interfaces.Repository
{
    public interface IAttendanceAuditTrailRepository : IGenericRepository<AttendanceAuditTrail>
    {
    }
}
