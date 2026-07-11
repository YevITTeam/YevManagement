using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceEmailRepository : GenericRepository<DeviceEmail, AssetDbContext>, IDeviceEmailRepository
    {
        public DeviceEmailRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
