using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceGroupRepository : GenericRepository<DeviceGroup, AssetDbContext>, IDeviceGroupRepository
    {
        public DeviceGroupRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
