using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class AttendanceAuditTrailRepository : GenericRepository<AttendanceAuditTrail, AttendanceDbContext>, IAttendanceAuditTrailRepository
    {
        public AttendanceAuditTrailRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
