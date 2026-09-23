using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class InventoryAssignmentRepository : GenericRepository<InventoryAssignment, AssetDbContext>, IInventoryAssignmentRepository
    {
        public InventoryAssignmentRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
