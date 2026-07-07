using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceTypeRepository : GenericRepository<DeviceType, AssetDbContext>, IDeviceTypeRepository
    {
        public DeviceTypeRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
