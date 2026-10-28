using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class EmployeeApprovalScopeRepository : GenericRepository<EmployeeApprovalScope, AttendanceDbContext>, IEmployeeApprovalScopeRepository
    {
        public EmployeeApprovalScopeRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
