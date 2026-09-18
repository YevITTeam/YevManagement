using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class ServerCheckManualItemRepository : GenericRepository<ServerCheckManualItem, AssetDbContext>, IServerCheckManualItemRepository
    {
        public ServerCheckManualItemRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
