using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormBatchEmailTokenRepository : GenericRepository<OtFormBatchEmailToken, AttendanceDbContext>, IOtFormBatchEmailTokenRepository
    {
        public OtFormBatchEmailTokenRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
