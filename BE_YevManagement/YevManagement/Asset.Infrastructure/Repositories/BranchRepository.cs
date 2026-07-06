using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class BranchRepository : GenericRepository<Branch, AssetDbContext>, IBranchRepository
    {
        public BranchRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
