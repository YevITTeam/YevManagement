using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class GroupRepository : GenericRepository<Group, AttendanceDbContext>, IGroupRepository
    {
        public GroupRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
