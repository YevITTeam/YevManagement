using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class UsbFileEventRepository : GenericRepository<UsbFileEvent, AssetDbContext>, IUsbFileEventRepository
    {
        public UsbFileEventRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
