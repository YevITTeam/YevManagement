using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class ServerCheckSessionRepository : GenericRepository<ServerCheckSession, AssetDbContext>, IServerCheckSessionRepository
    {
        public ServerCheckSessionRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
