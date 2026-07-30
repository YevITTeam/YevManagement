using Attendance.Domain.Entities;
using Shared.Application.Abstractions;

namespace Attendance.Application.Interfaces.Repository
{
    public interface IPendingSecondaryPasswordConfirmationRepository : IGenericRepository<PendingSecondaryPasswordConfirmation>
    {
    }
}
