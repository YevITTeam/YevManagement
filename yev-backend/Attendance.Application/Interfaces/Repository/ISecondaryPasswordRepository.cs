using Attendance.Domain.Entities;
using Shared.Application.Abstractions;

namespace Attendance.Application.Interfaces.Repository
{
    public interface ISecondaryPasswordRepository : IGenericRepository<SecondaryPassword>
    {
        // Written straight to the DB, outside the caller's pending changes, because the caller then throws.
        Task RegisterFailedAttemptAsync(int id, int maxAttempts, DateTime lockUntil);

        Task ResetFailedAttemptsAsync(int id);
    }
}
