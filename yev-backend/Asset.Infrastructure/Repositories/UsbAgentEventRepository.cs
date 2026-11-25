using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class UsbAgentEventRepository : GenericRepository<UsbAgentEvent, AssetDbContext>, IUsbAgentEventRepository
    {
        public UsbAgentEventRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
