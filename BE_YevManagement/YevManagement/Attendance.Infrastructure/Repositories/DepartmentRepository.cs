using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class DepartmentRepository : GenericRepository<Department, AttendanceDbContext>, IDepartmentRepository
    {
        public DepartmentRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
