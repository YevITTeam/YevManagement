using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class DeviceDepartmentRepository : GenericRepository<DeviceDepartment, AssetDbContext>, IDeviceDepartmentRepository
    {
        public DeviceDepartmentRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
