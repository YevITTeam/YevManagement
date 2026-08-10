using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class GroupApprovalStepRepository : GenericRepository<GroupApprovalStep, AttendanceDbContext>, IGroupApprovalStepRepository
    {
        public GroupApprovalStepRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
