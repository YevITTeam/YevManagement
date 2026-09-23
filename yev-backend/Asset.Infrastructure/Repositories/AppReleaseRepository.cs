using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class AppReleaseRepository : GenericRepository<AppRelease, AssetDbContext>, IAppReleaseRepository
    {
        public AppReleaseRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
