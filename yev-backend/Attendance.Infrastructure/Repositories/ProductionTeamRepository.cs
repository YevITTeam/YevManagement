using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class ProductionTeamRepository : GenericRepository<ProductionTeam, AttendanceDbContext>, IProductionTeamRepository
    {
        public ProductionTeamRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
