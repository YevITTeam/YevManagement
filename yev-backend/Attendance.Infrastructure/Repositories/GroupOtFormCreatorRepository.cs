using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class GroupOtFormCreatorRepository : GenericRepository<GroupOtFormCreator, AttendanceDbContext>, IGroupOtFormCreatorRepository
    {
        public GroupOtFormCreatorRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
