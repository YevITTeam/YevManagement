using Asset.Domain.Models;
using Shared.Application.Abstractions;

namespace Asset.Application.Interfaces.Repository
{
    public interface IAuditTrailRepository : IGenericRepository<AuditTrail>
    {
    }
}
