using Asset.Application.Interfaces.Repository;
using Asset.Application.Interfaces.Service;
using Asset.Infrastructure.Context;
using Shared.Infrastructure.Data;

namespace Asset.Infrastructure.Repositories
{
    public class AssetUnitOfWork : BaseUnitOfWork<AssetDbContext>, IAssetUnitOfWork
    {
        public AssetUnitOfWork(
            AssetDbContext dbContext,
            IDeviceRepository devices,
            IBranchRepository branches,
            ISoftwareRepository softwares,
            ISupplierRepository suppliers,
            IDeviceConfigurationRepository deviceConfigurations,
            IDeviceSoftwareRepository deviceSoftwares,
            IDeviceTypeRepository deviceTypes,
            IIpAddressRepository ipAddresses,
            ITransferHistoryRepository transferHistories,
            IAuditTrailRepository auditTrails) : base(dbContext)
        {
            Devices = devices;
            Branches = branches;
            Softwares = softwares;
            Suppliers = suppliers;
            DeviceConfigurations = deviceConfigurations;
            DeviceSoftwares = deviceSoftwares;
            DeviceTypes = deviceTypes;
            IpAddresses = ipAddresses;
            TransferHistories = transferHistories;
            AuditTrails = auditTrails;
        }

        public IDeviceRepository Devices { get; }
        public IBranchRepository Branches { get; }
        public ISoftwareRepository Softwares { get; }
        public ISupplierRepository Suppliers { get; }
        public IDeviceConfigurationRepository DeviceConfigurations { get; }
        public IDeviceSoftwareRepository DeviceSoftwares { get; }
        public IDeviceTypeRepository DeviceTypes { get; }
        public IIpAddressRepository IpAddresses { get; }
        public ITransferHistoryRepository TransferHistories { get; }
        public IAuditTrailRepository AuditTrails { get; }
    }
}
