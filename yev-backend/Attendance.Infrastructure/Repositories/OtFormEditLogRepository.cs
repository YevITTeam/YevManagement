using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormEditLogRepository : GenericRepository<OtFormEditLog, AttendanceDbContext>, IOtFormEditLogRepository
    {
        public OtFormEditLogRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
