using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceSoftwareRepository : GenericRepository<DeviceSoftware, AssetDbContext>, IDeviceSoftwareRepository
    {
        public DeviceSoftwareRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
