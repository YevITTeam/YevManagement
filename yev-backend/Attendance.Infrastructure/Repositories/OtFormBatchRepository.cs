using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormBatchRepository : GenericRepository<OtFormBatch, AttendanceDbContext>, IOtFormBatchRepository
    {
        public OtFormBatchRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
