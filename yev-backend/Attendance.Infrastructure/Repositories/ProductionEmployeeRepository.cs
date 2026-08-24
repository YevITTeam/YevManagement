using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class ProductionEmployeeRepository : GenericRepository<ProductionEmployee, AttendanceDbContext>, IProductionEmployeeRepository
    {
        public ProductionEmployeeRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
