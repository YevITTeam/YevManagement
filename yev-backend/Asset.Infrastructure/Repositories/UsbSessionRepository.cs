using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class UsbSessionRepository : GenericRepository<UsbSession, AssetDbContext>, IUsbSessionRepository
    {
        public UsbSessionRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
