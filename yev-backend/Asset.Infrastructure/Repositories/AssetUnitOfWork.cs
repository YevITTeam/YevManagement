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
            IAssetSettingRepository assetSettings,
            IDeviceGroupRepository deviceGroups,
            IDeviceDepartmentRepository deviceDepartments,
            ISoftwareRepository softwares,
            ISoftwareGroupRepository softwareGroups,
            ISupplierRepository suppliers,
            IDeviceConfigurationRepository deviceConfigurations,
            IDeviceConfigurationInitialRepository deviceConfigurationInitials,
            IDeviceConfigurationHistoryRepository deviceConfigurationHistories,
            IDeviceEmailRepository deviceEmails,
            IDeviceSoftwareRepository deviceSoftwares,
            IDeviceTypeRepository deviceTypes,
            IIpAddressRepository ipAddresses,
            IIpPrefixRepository ipPrefixes,
            ITransferHistoryRepository transferHistories,
            IAuditTrailRepository auditTrails,
            IServerCheckSessionRepository serverCheckSessions,
            IServerCheckItemRepository serverCheckItems,
            IServerCheckManualItemRepository serverCheckManualItems,
            IServerCheckManualResultRepository serverCheckManualResults,
            IServerCheckAssignmentRepository serverCheckAssignments,
            IInventorySessionRepository inventorySessions,
            IInventorySessionItemRepository inventorySessionItems,
            IInventoryAssignmentRepository inventoryAssignments,
            IAppReleaseRepository appReleases,
            IUsbDeviceRepository usbDevices,
            IUsbSessionRepository usbSessions,
            IUsbFileEventRepository usbFileEvents) : base(dbContext)
        {
            Devices = devices;
            Branches = branches;
            AssetSettings = assetSettings;
            DeviceGroups = deviceGroups;
            DeviceDepartments = deviceDepartments;
            Softwares = softwares;
            SoftwareGroups = softwareGroups;
            Suppliers = suppliers;
            DeviceConfigurations = deviceConfigurations;
            DeviceConfigurationInitials = deviceConfigurationInitials;
            DeviceConfigurationHistories = deviceConfigurationHistories;
            DeviceEmails = deviceEmails;
            DeviceSoftwares = deviceSoftwares;
            DeviceTypes = deviceTypes;
            IpAddresses = ipAddresses;
            IpPrefixes = ipPrefixes;
            TransferHistories = transferHistories;
            AuditTrails = auditTrails;
            ServerCheckSessions = serverCheckSessions;
            ServerCheckItems = serverCheckItems;
            ServerCheckManualItems = serverCheckManualItems;
            ServerCheckManualResults = serverCheckManualResults;
            ServerCheckAssignments = serverCheckAssignments;
            InventorySessions = inventorySessions;
            InventorySessionItems = inventorySessionItems;
            InventoryAssignments = inventoryAssignments;
            AppReleases = appReleases;
            UsbDevices = usbDevices;
            UsbSessions = usbSessions;
            UsbFileEvents = usbFileEvents;
        }

        public IDeviceRepository Devices { get; }
        public IBranchRepository Branches { get; }
        public IAssetSettingRepository AssetSettings { get; }
        public IDeviceGroupRepository DeviceGroups { get; }
        public IDeviceDepartmentRepository DeviceDepartments { get; }
        public ISoftwareRepository Softwares { get; }
        public ISoftwareGroupRepository SoftwareGroups { get; }
        public ISupplierRepository Suppliers { get; }
        public IDeviceConfigurationRepository DeviceConfigurations { get; }
        public IDeviceConfigurationInitialRepository DeviceConfigurationInitials { get; }
        public IDeviceConfigurationHistoryRepository DeviceConfigurationHistories { get; }
        public IDeviceEmailRepository DeviceEmails { get; }
        public IDeviceSoftwareRepository DeviceSoftwares { get; }
        public IDeviceTypeRepository DeviceTypes { get; }
        public IIpAddressRepository IpAddresses { get; }
        public IIpPrefixRepository IpPrefixes { get; }
        public ITransferHistoryRepository TransferHistories { get; }
        public IAuditTrailRepository AuditTrails { get; }
        public IServerCheckSessionRepository ServerCheckSessions { get; }
        public IServerCheckItemRepository ServerCheckItems { get; }
        public IServerCheckManualItemRepository ServerCheckManualItems { get; }
        public IServerCheckManualResultRepository ServerCheckManualResults { get; }
        public IServerCheckAssignmentRepository ServerCheckAssignments { get; }
        public IInventorySessionRepository InventorySessions { get; }
        public IInventorySessionItemRepository InventorySessionItems { get; }
        public IInventoryAssignmentRepository InventoryAssignments { get; }
        public IAppReleaseRepository AppReleases { get; }
        public IUsbDeviceRepository UsbDevices { get; }
        public IUsbSessionRepository UsbSessions { get; }
        public IUsbFileEventRepository UsbFileEvents { get; }
    }
}
