using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class ServerCheckItemRepository : GenericRepository<ServerCheckItem, AssetDbContext>, IServerCheckItemRepository
    {
        public ServerCheckItemRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
