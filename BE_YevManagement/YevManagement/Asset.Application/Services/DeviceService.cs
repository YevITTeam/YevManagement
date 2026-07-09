using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class DeviceService : BaseService<IAssetUnitOfWork>, IDeviceService
    {
        private readonly IDeviceConfigurationService _deviceConfigurationService;
        private readonly IDeviceSoftwareService _deviceSoftwareService;

        public DeviceService(
            IAssetUnitOfWork unitOfWork,
            IDeviceConfigurationService deviceConfigurationService,
            IDeviceSoftwareService deviceSoftwareService) : base(unitOfWork)
        {
            _deviceConfigurationService = deviceConfigurationService;
            _deviceSoftwareService = deviceSoftwareService;
        }

        public async Task<PagedResponse<DeviceGridDto>> GetDevicesForGridAsync(DeviceFilterRequest request)
        {
            var query = _unitOfWork.Devices.GetQueryable(
                false,
                d => d.Branch,
                d => d.Supplier,
                d => d.DeviceType);

            query = query.Where(d => !d.IsDeleted);

            if (!string.IsNullOrWhiteSpace(request.DeviceCode))
            {
                query = query.Where(d => d.DeviceCode.StartsWith(request.DeviceCode));
            }

            if (!string.IsNullOrWhiteSpace(request.Manager))
            {
                query = query.Where(d => d.Manager.StartsWith(request.Manager));
            }

            if (!string.IsNullOrWhiteSpace(request.SupplierName))
            {
                query = query.Where(d => d.Supplier.SupplierName.StartsWith(request.SupplierName));
            }

            if (!string.IsNullOrWhiteSpace(request.PurchaseDate))
            {
                query = query.Where(d => d.PurchaseDate.ToString().Contains(request.PurchaseDate));
            }

            if (!string.IsNullOrWhiteSpace(request.Note))
            {
                query = query.Where(d => d.Note != null && d.Note.Contains(request.Note));
            }

            if (request.IsOutsourced.HasValue)
            {
                query = query.Where(d => d.IsOutsourced == request.IsOutsourced.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.SerialNumber))
            {
                query = query.Where(d => d.SerialNumber != null && d.SerialNumber.Contains(request.SerialNumber));
            }

            if (request.IsUseUsb.HasValue)
            {
                query = query.Where(d => d.IsUseUsb == request.IsUseUsb.Value);
            }

            return await _unitOfWork.Devices.ToPagedResponseAsync(
                query.OrderByDescending(d => d.PurchaseDate),
                request.PageIndex,
                request.PageSize,
                d => new DeviceGridDto
                {
                    Id = d.Id,
                    DeviceCode = d.DeviceCode,
                    DeviceName = d.DeviceName,
                    BranchName = d.Branch.BranchName,
                    SupplierName = d.Supplier.SupplierName,
                    DeviceTypeName = d.DeviceType.TypeName,
                    IpAddress = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).FirstOrDefault(),
                    PurchaseDate = d.PurchaseDate,
                    ExpirationDate = d.ExpirationDate,
                    Manager = d.Manager,
                    Note = d.Note,
                    Email = d.Email,
                    IsOutsourced = d.IsOutsourced,
                    SerialNumber = d.SerialNumber,
                    IsUseUsb = d.IsUseUsb,
                    Status = d.Status,
                    // Lặp lại logic của GetStatusText tại đây (không gọi method) vì đây là
                    // Expression<Func<>> được EF dịch sang SQL, không hỗ trợ gọi method C# tuỳ ý.
                    StatusText = d.Status == (int)DeviceStatus.PendingUse ? "Chờ sử dụng"
                        : d.Status == (int)DeviceStatus.InUse ? "Đang sử dụng"
                        : d.Status == (int)DeviceStatus.PendingLiquidation ? "Chờ thanh lý"
                        : d.Status == (int)DeviceStatus.Liquidated ? "Đã thanh lý"
                        : "Không xác định"
                }
            );
        }

        public async Task<DeviceDto> GetByIdAsync(int id)
        {
            var device = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.Id == id, x => x.Branch, x => x.DeviceType, x => x.Supplier);
            device.OrThrowNotFound("Thiết bị", id);

            var currentIp = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.DeviceId == id && !x.IsDeleted);

            return MapToDto(device, currentIp);
        }

        public async Task<DeviceDetailDto> GetDetailAsync(int id)
        {
            var device = await GetByIdAsync(id);
            var configuration = await _deviceConfigurationService.GetByDeviceIdAsync(id);
            var softwares = await _deviceSoftwareService.GetByDeviceIdAsync(id);

            return new DeviceDetailDto
            {
                Device = device,
                Configuration = configuration,
                Softwares = softwares
            };
        }

        public async Task<DeviceDto> CreateAsync(CreateDeviceDto request)
        {
            var codeExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == request.DeviceCode);
            if (codeExists != null) throw new DomainException($"Mã thiết bị '{request.DeviceCode}' đã tồn tại.");

            if (!string.IsNullOrWhiteSpace(request.SerialNumber))
            {
                var serialExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.SerialNumber == request.SerialNumber);
                if (serialExists != null) throw new DomainException($"Số Serial '{request.SerialNumber}' đã tồn tại.");
            }

            var deviceType = await _unitOfWork.DeviceTypes.GetByIdAsync(request.DeviceTypeId);
            deviceType.OrThrowNotFound("Loại thiết bị", request.DeviceTypeId);

            var supplier = await _unitOfWork.Suppliers.GetByIdAsync(request.SupplierId);
            supplier.OrThrowNotFound("Nhà cung cấp", request.SupplierId);

            var branch = await _unitOfWork.Branches.GetByIdAsync(request.BranchId);
            branch.OrThrowNotFound("Chi nhánh", request.BranchId);

            IpAddress? ipAddress = null;
            if (request.IpAddressId.HasValue)
            {
                ipAddress = await _unitOfWork.IpAddresses.GetByIdAsync(request.IpAddressId.Value);
                ipAddress.OrThrowNotFound("Địa chỉ IP", request.IpAddressId.Value);
                if (ipAddress.Status != (int)IpAddressStatus.Available)
                    throw new DomainException("Địa chỉ IP đã được sử dụng, vui lòng chọn IP khác.");
            }

            var newDevice = new Device
            {
                DeviceCode = request.DeviceCode,
                DeviceName = request.DeviceName,
                DeviceTypeId = request.DeviceTypeId,
                SupplierId = request.SupplierId,
                BranchId = request.BranchId,
                Manager = request.Manager,
                Email = request.Email,
                PurchaseDate = request.PurchaseDate,
                DepreciationMonths = request.DepreciationMonths,
                ExpirationDate = request.PurchaseDate.AddMonths(request.DepreciationMonths),
                IsOutsourced = request.IsOutsourced,
                Status = request.Status,
                Note = request.Note,
                SerialNumber = request.SerialNumber,
                IsUseUsb = request.IsUseUsb,
                IsDeleted = false
            };

            await _unitOfWork.Devices.AddAsync(newDevice);
            await _unitOfWork.SaveChangesAsync();

            if (ipAddress != null)
            {
                ipAddress.DeviceId = newDevice.Id;
                ipAddress.Status = (int)IpAddressStatus.Assigned;
                _unitOfWork.IpAddresses.Update(ipAddress);
                await _unitOfWork.SaveChangesAsync();
            }

            newDevice.Branch = branch;
            newDevice.DeviceType = deviceType;
            newDevice.Supplier = supplier;
            return MapToDto(newDevice, ipAddress);
        }

        public async Task UpdateAsync(UpdateDeviceDto request)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(request.Id);
            device.OrThrowNotFound("Thiết bị", request.Id);

            if (device.DeviceCode != request.DeviceCode)
            {
                var codeExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.DeviceCode == request.DeviceCode);
                if (codeExists != null) throw new DomainException($"Mã thiết bị '{request.DeviceCode}' đã tồn tại.");
            }

            if (!string.IsNullOrWhiteSpace(request.SerialNumber) && device.SerialNumber != request.SerialNumber)
            {
                var serialExists = await _unitOfWork.Devices.FirstOrDefaultAsync(x => x.SerialNumber == request.SerialNumber);
                if (serialExists != null) throw new DomainException($"Số Serial '{request.SerialNumber}' đã tồn tại.");
            }

            var deviceType = await _unitOfWork.DeviceTypes.GetByIdAsync(request.DeviceTypeId);
            deviceType.OrThrowNotFound("Loại thiết bị", request.DeviceTypeId);

            var supplier = await _unitOfWork.Suppliers.GetByIdAsync(request.SupplierId);
            supplier.OrThrowNotFound("Nhà cung cấp", request.SupplierId);

            var branch = await _unitOfWork.Branches.GetByIdAsync(request.BranchId);
            branch.OrThrowNotFound("Chi nhánh", request.BranchId);

            var currentIp = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.DeviceId == device.Id && !x.IsDeleted);

            if (currentIp?.Id != request.IpAddressId)
            {
                if (currentIp != null)
                {
                    currentIp.DeviceId = null;
                    currentIp.Status = (int)IpAddressStatus.Available;
                    _unitOfWork.IpAddresses.Update(currentIp);
                }

                if (request.IpAddressId.HasValue)
                {
                    var newIp = await _unitOfWork.IpAddresses.GetByIdAsync(request.IpAddressId.Value);
                    newIp.OrThrowNotFound("Địa chỉ IP", request.IpAddressId.Value);
                    if (newIp.Status != (int)IpAddressStatus.Available)
                        throw new DomainException("Địa chỉ IP đã được sử dụng, vui lòng chọn IP khác.");

                    newIp.DeviceId = device.Id;
                    newIp.Status = (int)IpAddressStatus.Assigned;
                    _unitOfWork.IpAddresses.Update(newIp);
                }
            }

            device.DeviceCode = request.DeviceCode;
            device.DeviceName = request.DeviceName;
            device.DeviceTypeId = request.DeviceTypeId;
            device.SupplierId = request.SupplierId;
            device.BranchId = request.BranchId;
            device.Manager = request.Manager;
            device.Email = request.Email;
            device.PurchaseDate = request.PurchaseDate;
            device.DepreciationMonths = request.DepreciationMonths;
            device.ExpirationDate = request.PurchaseDate.AddMonths(request.DepreciationMonths);
            device.IsOutsourced = request.IsOutsourced;
            device.Status = request.Status;
            device.Note = request.Note;
            device.SerialNumber = request.SerialNumber;
            device.IsUseUsb = request.IsUseUsb;

            _unitOfWork.Devices.Update(device);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(id);
            device.OrThrowNotFound("Thiết bị", id);

            device.IsDeleted = true;
            _unitOfWork.Devices.Update(device);

            var assignedIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == id && !x.IsDeleted);
            foreach (var ip in assignedIps)
            {
                ip.DeviceId = null;
                ip.Status = (int)IpAddressStatus.Available;
                _unitOfWork.IpAddresses.Update(ip);
            }

            await _unitOfWork.SaveChangesAsync();
        }

        private static DeviceDto MapToDto(Device device, IpAddress? ipAddress) => new DeviceDto
        {
            Id = device.Id,
            DeviceCode = device.DeviceCode,
            DeviceName = device.DeviceName,
            DeviceTypeId = device.DeviceTypeId,
            DeviceTypeName = device.DeviceType?.TypeName!,
            SupplierId = device.SupplierId,
            SupplierName = device.Supplier?.SupplierName!,
            BranchId = device.BranchId,
            BranchName = device.Branch?.BranchName!,
            Manager = device.Manager,
            Email = device.Email,
            PurchaseDate = device.PurchaseDate,
            DepreciationMonths = device.DepreciationMonths,
            ExpirationDate = device.ExpirationDate,
            IsOutsourced = device.IsOutsourced,
            Status = device.Status,
            StatusText = GetStatusText(device.Status),
            Note = device.Note,
            SerialNumber = device.SerialNumber,
            IsUseUsb = device.IsUseUsb,
            IpAddressId = ipAddress?.Id,
            IpAddress = ipAddress?.IpAddress1
        };

        private static string GetStatusText(int status) => status switch
        {
            (int)DeviceStatus.PendingUse => "Chờ sử dụng",
            (int)DeviceStatus.InUse => "Đang sử dụng",
            (int)DeviceStatus.PendingLiquidation => "Chờ thanh lý",
            (int)DeviceStatus.Liquidated => "Đã thanh lý",
            _ => "Không xác định"
        };
    }
}
