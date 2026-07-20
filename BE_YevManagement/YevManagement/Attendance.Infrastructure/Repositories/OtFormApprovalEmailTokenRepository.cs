using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormApprovalEmailTokenRepository : GenericRepository<OtFormApprovalEmailToken, AttendanceDbContext>, IOtFormApprovalEmailTokenRepository
    {
        public OtFormApprovalEmailTokenRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
