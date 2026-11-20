using Asset.Application.Interfaces.Repository;
using Asset.Domain.Entities;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Repositories;

namespace Asset.Infrastructure.Repositories
{
    public class UsbDeviceMachineRepository : GenericRepository<UsbDeviceMachine, AssetDbContext>, IUsbDeviceMachineRepository
    {
        public UsbDeviceMachineRepository(AssetDbContext dbContext) : base(dbContext)
        {
        }
    }
}
