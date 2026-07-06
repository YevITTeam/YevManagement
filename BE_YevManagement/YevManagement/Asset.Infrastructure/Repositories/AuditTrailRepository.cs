using Asset.Application.Interfaces.Repository;
using Asset.Domain.Models;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class AuditTrailRepository : GenericRepository<AuditTrail, AssetDbContext>, IAuditTrailRepository
    {
        public AuditTrailRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
