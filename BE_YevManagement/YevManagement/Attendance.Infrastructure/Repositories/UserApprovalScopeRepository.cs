using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class UserApprovalScopeRepository : GenericRepository<UserApprovalScope, AttendanceDbContext>, IUserApprovalScopeRepository
    {
        public UserApprovalScopeRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
