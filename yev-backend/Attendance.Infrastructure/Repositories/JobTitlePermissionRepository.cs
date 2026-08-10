using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class JobTitlePermissionRepository : GenericRepository<JobTitlePermission, AttendanceDbContext>, IJobTitlePermissionRepository
    {
        public JobTitlePermissionRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
