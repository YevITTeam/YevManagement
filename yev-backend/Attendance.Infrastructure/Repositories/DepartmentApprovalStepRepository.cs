using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class DepartmentApprovalStepRepository : GenericRepository<DepartmentApprovalStep, AttendanceDbContext>, IDepartmentApprovalStepRepository
    {
        public DepartmentApprovalStepRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
