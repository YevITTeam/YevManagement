using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class SoftwareRepository : GenericRepository<Software, AssetDbContext>, ISoftwareRepository
    {
        public SoftwareRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
