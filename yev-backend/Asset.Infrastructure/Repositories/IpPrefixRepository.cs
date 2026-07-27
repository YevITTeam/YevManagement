using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class IpPrefixRepository : GenericRepository<IpPrefix, AssetDbContext>, IIpPrefixRepository
    {
        public IpPrefixRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
