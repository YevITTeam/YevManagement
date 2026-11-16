using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class ProductionTaskRepository : GenericRepository<ProductionTask, AttendanceDbContext>, IProductionTaskRepository
    {
        public ProductionTaskRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
