using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceConfigurationInitialRepository : GenericRepository<DeviceConfigurationInitial, AssetDbContext>, IDeviceConfigurationInitialRepository
    {
        public DeviceConfigurationInitialRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
