using Asset.Application.Dtos.IpAddresses;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Services
{
    public class IpAddressService : BaseService<IAssetUnitOfWork>, IIpAddressService
    {
        public IpAddressService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<IpAddressDto>> GetPagedAsync(IpAddressFilterRequest request)
        {
            var query = _unitOfWork.IpAddresses.GetQueryable(false, x => x.Device, x => x.IpPrefix).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(request.Keyword))
            {
                query = query.Where(x => x.IpAddress1.Contains(request.Keyword)
                    || (x.Note != null && x.Note.Contains(request.Keyword)));
            }

            if (request.Status.HasValue)
            {
                query = query.Where(x => x.Status == request.Status.Value);
            }

            if (request.DeviceId.HasValue)
            {
                query = query.Where(x => x.DeviceId == request.DeviceId.Value);
            }

            return await _unitOfWork.IpAddresses.ToPagedResponseAsync(
                query.OrderBy(x => x.IpAddress1),
                request.PageIndex,
                request.PageSize,
                x => new IpAddressDto
                {
                    Id = x.Id,
                    IpAddress = x.IpAddress1,
                    ServerIp = x.ServerIp,
                    DeviceId = x.DeviceId,
                    DeviceCode = x.Device != null ? x.Device.DeviceCode : null,
                    IpPrefixId = x.IpPrefixId,
                    Prefix = x.IpPrefix.Prefix,
                    PrefixSubnetMask = x.IpPrefix.SubnetMask,
                    PrefixGateway = x.IpPrefix.Gateway,
                    PrefixPreferredDns = x.IpPrefix.PreferredDns,
                    PrefixAlternateDns = x.IpPrefix.AlternateDns,
                    Status = x.Status,
                    // Lặp lại logic của GetStatusText tại đây (không gọi method) vì đây là
                    // Expression<Func<>> được EF dịch sang SQL, không hỗ trợ gọi method C# tuỳ ý.
                    StatusText = x.Status == (int)IpAddressStatus.Available ? "Chưa gán"
                        : x.Status == (int)IpAddressStatus.Assigned ? "Đã gán"
                        : x.Status == (int)IpAddressStatus.Reserved ? "Giữ chỗ"
                        : x.Status == (int)IpAddressStatus.Disabled ? "Ngưng dùng"
                        : "Không xác định",
                    Note = x.Note
                }
            );
        }

        public async Task<List<IpAddressDto>> GetAvailableAsync(string? keyword)
        {
            var normalizedKeyword = string.IsNullOrWhiteSpace(keyword) ? "" : keyword.Trim();

            var ipAddresses = await _unitOfWork.IpAddresses.SelectAsync(
                predicate: x => !x.IsDeleted
                    && x.Status == (int)IpAddressStatus.Available
                    && x.IpAddress1.Contains(normalizedKeyword),
                selector: x => new IpAddressDto
                {
                    Id = x.Id,
                    IpAddress = x.IpAddress1,
                    ServerIp = x.ServerIp,
                    DeviceId = x.DeviceId,
                    DeviceCode = null,
                    IpPrefixId = x.IpPrefixId,
                    Prefix = x.IpPrefix.Prefix,
                    PrefixSubnetMask = x.IpPrefix.SubnetMask,
                    PrefixGateway = x.IpPrefix.Gateway,
                    PrefixPreferredDns = x.IpPrefix.PreferredDns,
                    PrefixAlternateDns = x.IpPrefix.AlternateDns,
                    Status = x.Status,
                    StatusText = "Chưa gán",
                    Note = x.Note
                });

            return ipAddresses.OrderBy(x => x.IpAddress).ToList();
        }

        public async Task<IpAddressDto> GetByIdAsync(int id)
        {
            var ipAddress = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.Id == id, x => x.Device, x => x.IpPrefix);
            ipAddress.OrThrowNotFound("Địa chỉ IP", id);

            return MapToDto(ipAddress);
        }

        public async Task<IpAddressDto> CreateAsync(CreateIpAddressDto request)
        {
            var exists = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.IpAddress1 == request.IpAddress);
            if (exists != null) throw new DomainException($"Địa chỉ IP '{request.IpAddress}' đã tồn tại.");

            var ipPrefix = await _unitOfWork.IpPrefixes.GetByIdAsync(request.IpPrefixId);
            ipPrefix.OrThrowNotFound("Prefix", request.IpPrefixId);

            if (!request.IpAddress.StartsWith(ipPrefix.Prefix + "."))
                throw new DomainException($"Địa chỉ IP '{request.IpAddress}' không thuộc prefix '{ipPrefix.Prefix}'.");

            Device? device = null;
            int status;

            if (request.DeviceId.HasValue)
            {
                device = await _unitOfWork.Devices.GetByIdAsync(request.DeviceId.Value);
                device.OrThrowNotFound("Thiết bị", request.DeviceId.Value);
                status = (int)IpAddressStatus.Assigned;
            }
            else
            {
                status = request.Status ?? (int)IpAddressStatus.Available;
                if (status == (int)IpAddressStatus.Assigned)
                    throw new DomainException("Không thể đặt trạng thái 'Đã gán' khi chưa chọn thiết bị.");
            }

            var newIpAddress = new IpAddress
            {
                IpAddress1 = request.IpAddress,
                ServerIp = request.ServerIp,
                DeviceId = request.DeviceId,
                IpPrefixId = request.IpPrefixId,
                Status = status,
                Note = request.Note,
                IsDeleted = false
            };

            await _unitOfWork.IpAddresses.AddAsync(newIpAddress);
            await _unitOfWork.SaveChangesAsync();

            var dto = MapToDto(newIpAddress);
            dto.DeviceCode = device?.DeviceCode;
            dto.Prefix = ipPrefix.Prefix;
            dto.PrefixSubnetMask = ipPrefix.SubnetMask;
            dto.PrefixGateway = ipPrefix.Gateway;
            dto.PrefixPreferredDns = ipPrefix.PreferredDns;
            dto.PrefixAlternateDns = ipPrefix.AlternateDns;
            return dto;
        }

        public async Task UpdateAsync(UpdateIpAddressDto request)
        {
            var ipAddress = await _unitOfWork.IpAddresses.GetByIdAsync(request.Id);
            ipAddress.OrThrowNotFound("Địa chỉ IP", request.Id);

            if (ipAddress.IpAddress1 != request.IpAddress)
            {
                var exists = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.IpAddress1 == request.IpAddress);
                if (exists != null) throw new DomainException($"Địa chỉ IP '{request.IpAddress}' đã tồn tại.");
            }

            var ipPrefix = await _unitOfWork.IpPrefixes.GetByIdAsync(request.IpPrefixId);
            ipPrefix.OrThrowNotFound("Prefix", request.IpPrefixId);

            if (!request.IpAddress.StartsWith(ipPrefix.Prefix + "."))
                throw new DomainException($"Địa chỉ IP '{request.IpAddress}' không thuộc prefix '{ipPrefix.Prefix}'.");

            int status;
            if (request.DeviceId.HasValue)
            {
                var device = await _unitOfWork.Devices.GetByIdAsync(request.DeviceId.Value);
                device.OrThrowNotFound("Thiết bị", request.DeviceId.Value);
                status = (int)IpAddressStatus.Assigned;
            }
            else if (ipAddress.DeviceId.HasValue)
            {
                status = (int)IpAddressStatus.Available;
            }
            else
            {
                status = request.Status ?? (int)IpAddressStatus.Available;
                if (status == (int)IpAddressStatus.Assigned)
                    throw new DomainException("Không thể đặt trạng thái 'Đã gán' khi chưa chọn thiết bị.");
            }

            ipAddress.IpAddress1 = request.IpAddress;
            ipAddress.ServerIp = request.ServerIp;
            ipAddress.DeviceId = request.DeviceId;
            ipAddress.IpPrefixId = request.IpPrefixId;
            ipAddress.Status = status;
            ipAddress.Note = request.Note;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var ipAddress = await _unitOfWork.IpAddresses.GetByIdAsync(id);
            ipAddress.OrThrowNotFound("Địa chỉ IP", id);

            ipAddress.IsDeleted = true;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task AssignToDeviceAsync(int id, AssignIpAddressDto request)
        {
            var ipAddress = await _unitOfWork.IpAddresses.GetByIdAsync(id);
            ipAddress.OrThrowNotFound("Địa chỉ IP", id);

            if (ipAddress.Status == (int)IpAddressStatus.Disabled)
                throw new DomainException("Địa chỉ IP đang bị vô hiệu hoá, không thể gán cho thiết bị.");

            var device = await _unitOfWork.Devices.GetByIdAsync(request.DeviceId);
            device.OrThrowNotFound("Thiết bị", request.DeviceId);

            ipAddress.DeviceId = request.DeviceId;
            ipAddress.Status = (int)IpAddressStatus.Assigned;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task UnassignAsync(int id)
        {
            var ipAddress = await _unitOfWork.IpAddresses.GetByIdAsync(id);
            ipAddress.OrThrowNotFound("Địa chỉ IP", id);

            ipAddress.DeviceId = null;
            ipAddress.Status = (int)IpAddressStatus.Available;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        private static IpAddressDto MapToDto(IpAddress ipAddress) => new IpAddressDto
        {
            Id = ipAddress.Id,
            IpAddress = ipAddress.IpAddress1,
            ServerIp = ipAddress.ServerIp,
            DeviceId = ipAddress.DeviceId,
            DeviceCode = ipAddress.Device?.DeviceCode,
            IpPrefixId = ipAddress.IpPrefixId,
            Prefix = ipAddress.IpPrefix?.Prefix!,
            PrefixSubnetMask = ipAddress.IpPrefix?.SubnetMask,
            PrefixGateway = ipAddress.IpPrefix?.Gateway,
            PrefixPreferredDns = ipAddress.IpPrefix?.PreferredDns,
            PrefixAlternateDns = ipAddress.IpPrefix?.AlternateDns,
            Status = ipAddress.Status,
            StatusText = GetStatusText(ipAddress.Status),
            Note = ipAddress.Note
        };

        private static string GetStatusText(int status) => status switch
        {
            (int)IpAddressStatus.Available => "Chưa gán",
            (int)IpAddressStatus.Assigned => "Đã gán",
            (int)IpAddressStatus.Reserved => "Giữ chỗ",
            (int)IpAddressStatus.Disabled => "Ngưng dùng",
            _ => "Không xác định"
        };
    }
}
