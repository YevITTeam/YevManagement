using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class PendingSecondaryPasswordConfirmationRepository : GenericRepository<PendingSecondaryPasswordConfirmation, AttendanceDbContext>, IPendingSecondaryPasswordConfirmationRepository
    {
        public PendingSecondaryPasswordConfirmationRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }
    }
}
