using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class ServerCheckManualResultRepository : GenericRepository<ServerCheckManualResult, AssetDbContext>, IServerCheckManualResultRepository
    {
        public ServerCheckManualResultRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
