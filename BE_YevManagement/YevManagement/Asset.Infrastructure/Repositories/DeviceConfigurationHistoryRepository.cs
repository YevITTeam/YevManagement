using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceConfigurationHistoryRepository : GenericRepository<DeviceConfigurationHistory, AssetDbContext>, IDeviceConfigurationHistoryRepository
    {
        public DeviceConfigurationHistoryRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
