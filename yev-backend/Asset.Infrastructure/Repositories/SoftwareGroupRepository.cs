using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class SoftwareGroupRepository : GenericRepository<SoftwareGroup, AssetDbContext>, ISoftwareGroupRepository
    {
        public SoftwareGroupRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
