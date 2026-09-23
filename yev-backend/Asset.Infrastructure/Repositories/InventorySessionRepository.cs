using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class InventorySessionRepository : GenericRepository<InventorySession, AssetDbContext>, IInventorySessionRepository
    {
        public InventorySessionRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
