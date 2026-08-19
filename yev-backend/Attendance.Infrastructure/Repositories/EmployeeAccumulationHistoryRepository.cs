using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class EmployeeAccumulationHistoryRepository : GenericRepository<EmployeeAccumulationHistory, AttendanceDbContext>, IEmployeeAccumulationHistoryRepository
    {
        public EmployeeAccumulationHistoryRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
