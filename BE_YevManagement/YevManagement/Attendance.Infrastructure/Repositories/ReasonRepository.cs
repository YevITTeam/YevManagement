using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class ReasonRepository : GenericRepository<Reason, AttendanceDbContext>, IReasonRepository
    {
        public ReasonRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
