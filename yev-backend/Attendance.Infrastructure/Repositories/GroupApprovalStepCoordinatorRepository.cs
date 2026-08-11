using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class GroupApprovalStepCoordinatorRepository : GenericRepository<GroupApprovalStepCoordinator, AttendanceDbContext>, IGroupApprovalStepCoordinatorRepository
    {
        public GroupApprovalStepCoordinatorRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
