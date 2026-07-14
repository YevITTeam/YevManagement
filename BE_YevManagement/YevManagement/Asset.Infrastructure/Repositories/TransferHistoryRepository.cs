using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class TransferHistoryRepository : GenericRepository<TransferHistory, AssetDbContext>, ITransferHistoryRepository
    {
        public TransferHistoryRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
