using Attendance.Application.Interfaces.Repository;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;
using Shared.Infrastructure.Repositories;

namespace Attendance.Infrastructure.Repositories
{
    public class SecondaryPasswordRepository : GenericRepository<SecondaryPassword, AttendanceDbContext>, ISecondaryPasswordRepository
    {
        public SecondaryPasswordRepository(AttendanceDbContext dbContext) : base(dbContext)
        {
        }

        // One atomic UPDATE so parallel wrong guesses are all counted.
        public Task RegisterFailedAttemptAsync(int id, int maxAttempts, DateTime lockUntil) =>
            _dbSet.Where(x => x.Id == id).ExecuteUpdateAsync(s => s
                .SetProperty(x => x.LockedUntil, x => x.FailedAttempts + 1 >= maxAttempts ? lockUntil : x.LockedUntil)
                .SetProperty(x => x.FailedAttempts, x => x.FailedAttempts + 1 >= maxAttempts ? 0 : x.FailedAttempts + 1));

        public Task ResetFailedAttemptsAsync(int id) =>
            _dbSet.Where(x => x.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.FailedAttempts, 0));
    }
}
