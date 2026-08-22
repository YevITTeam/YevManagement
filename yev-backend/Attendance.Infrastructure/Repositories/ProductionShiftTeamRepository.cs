using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class ProductionShiftTeamRepository : GenericRepository<ProductionShiftTeam, AttendanceDbContext>, IProductionShiftTeamRepository
    {
        public ProductionShiftTeamRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
