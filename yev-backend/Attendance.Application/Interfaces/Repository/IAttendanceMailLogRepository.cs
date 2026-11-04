using Attendance.Domain.Entities;
using Shared.Application.Abstractions;

namespace Attendance.Application.Interfaces.Repository
{
    public interface IAttendanceMailLogRepository : IGenericRepository<AttendanceMailLog>
    {
        Task UpdateDeliveryAsync(long id, int status, int attempts, string? lastError, DateTime? sentAt);
    }
}
