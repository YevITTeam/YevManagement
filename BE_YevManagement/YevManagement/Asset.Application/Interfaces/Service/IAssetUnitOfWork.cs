using Asset.Application.Interfaces.Repository;
using Shared.Application.Abstractions;

namespace Asset.Application.Interfaces.Service
{
    public interface IAssetUnitOfWork : IUnitOfWork
    {
        IDeviceRepository Devices { get; }
        IBranchRepository Branches { get; }
        ISoftwareRepository Softwares { get; }
        ISoftwareGroupRepository SoftwareGroups { get; }
        ISupplierRepository Suppliers { get; }
        IDeviceConfigurationRepository DeviceConfigurations { get; }
        IDeviceSoftwareRepository DeviceSoftwares { get; }
        IDeviceTypeRepository DeviceTypes { get; }
        IIpAddressRepository IpAddresses { get; }
        ITransferHistoryRepository TransferHistories { get; }
        IAuditTrailRepository AuditTrails { get; }
    }
}
