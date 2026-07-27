using Attendance.Domain.Entities;
using Shared.Application.Abstractions;

namespace Attendance.Application.Interfaces.Repository
{
    public interface IPendingSignatureConfirmationRepository : IGenericRepository<PendingSignatureConfirmation>
    {
    }
}
