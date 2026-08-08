using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormApprovalStepRepository : GenericRepository<OtFormApprovalStep, AttendanceDbContext>, IOtFormApprovalStepRepository
    {
        public OtFormApprovalStepRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
