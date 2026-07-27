using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceConfigurationRepository : GenericRepository<DeviceConfiguration, AssetDbContext>, IDeviceConfigurationRepository
    {
        public DeviceConfigurationRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
