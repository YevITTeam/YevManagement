using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class InventorySessionItemRepository : GenericRepository<InventorySessionItem, AssetDbContext>, IInventorySessionItemRepository
    {
        public InventorySessionItemRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
