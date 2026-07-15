using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtCaseRepository : GenericRepository<OtCase, AttendanceDbContext>, IOtCaseRepository
    {
        public OtCaseRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
