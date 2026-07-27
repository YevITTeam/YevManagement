using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormApprovalHistoryRepository : GenericRepository<OtFormApprovalHistory, AttendanceDbContext>, IOtFormApprovalHistoryRepository
    {
        public OtFormApprovalHistoryRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
