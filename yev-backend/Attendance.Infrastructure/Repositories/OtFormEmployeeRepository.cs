using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormEmployeeRepository : GenericRepository<OtFormEmployee, AttendanceDbContext>, IOtFormEmployeeRepository
    {
        public OtFormEmployeeRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
