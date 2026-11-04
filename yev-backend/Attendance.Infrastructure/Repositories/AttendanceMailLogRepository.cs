using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class AttendanceMailLogRepository : GenericRepository<AttendanceMailLog, AttendanceDbContext>, IAttendanceMailLogRepository
    {
        public AttendanceMailLogRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }

        // Called from the outbox sender, outside any request; a direct UPDATE needs no tracked entity.
        public Task UpdateDeliveryAsync(long id, int status, int attempts, string? lastError, DateTime? sentAt) =>
            _dbSet.Where(x => x.Id == id).ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, status)
                .SetProperty(x => x.Attempts, attempts)
                .SetProperty(x => x.LastError, lastError)
                .SetProperty(x => x.SentAt, sentAt));
    }
}
