using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class JobTitleRepository : GenericRepository<JobTitle, AttendanceDbContext>, IJobTitleRepository
    {
        public JobTitleRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
