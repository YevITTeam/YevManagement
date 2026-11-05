using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class GeneralAffairsDispatchRepository : GenericRepository<GeneralAffairsDispatch, AttendanceDbContext>, IGeneralAffairsDispatchRepository
    {
        public GeneralAffairsDispatchRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
