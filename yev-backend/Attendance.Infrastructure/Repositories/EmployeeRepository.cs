using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class EmployeeRepository : GenericRepository<Employee, AttendanceDbContext>, IEmployeeRepository
    {
        public EmployeeRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
