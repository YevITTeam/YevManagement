using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class ProcessPartRepository : GenericRepository<ProcessPart, AttendanceDbContext>, IProcessPartRepository
    {
        public ProcessPartRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
