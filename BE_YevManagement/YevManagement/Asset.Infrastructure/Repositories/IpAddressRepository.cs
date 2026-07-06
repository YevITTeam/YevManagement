using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class IpAddressRepository : GenericRepository<IpAddress, AssetDbContext>, IIpAddressRepository
    {
        public IpAddressRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
