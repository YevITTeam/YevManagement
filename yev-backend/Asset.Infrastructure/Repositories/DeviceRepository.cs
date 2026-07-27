using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceRepository : GenericRepository<Device, AssetDbContext>, IDeviceRepository
    {
        public DeviceRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
