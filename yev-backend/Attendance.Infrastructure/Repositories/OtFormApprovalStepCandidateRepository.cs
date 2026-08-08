using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class OtFormApprovalStepCandidateRepository : GenericRepository<OtFormApprovalStepCandidate, AttendanceDbContext>, IOtFormApprovalStepCandidateRepository
    {
        public OtFormApprovalStepCandidateRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
