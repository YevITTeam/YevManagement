using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class UsbAgentRepository : GenericRepository<UsbAgent, AssetDbContext>, IUsbAgentRepository
    {
        public UsbAgentRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
