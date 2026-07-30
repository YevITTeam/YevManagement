using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class SecondaryPasswordRepository : GenericRepository<SecondaryPassword, AttendanceDbContext>, ISecondaryPasswordRepository
    {
        public SecondaryPasswordRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
