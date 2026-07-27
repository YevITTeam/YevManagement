using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class SupplierRepository : GenericRepository<Supplier, AssetDbContext>, ISupplierRepository
    {
        public SupplierRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
