using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class GroupApprovalStepMemberRepository : GenericRepository<GroupApprovalStepMember, AttendanceDbContext>, IGroupApprovalStepMemberRepository
    {
        public GroupApprovalStepMemberRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
