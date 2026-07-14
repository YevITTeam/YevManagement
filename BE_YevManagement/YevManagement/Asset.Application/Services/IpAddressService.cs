using Asset.Application.Dtos.IpAddresses;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
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

            // Lọc theo mức độ sử dụng: đang sử dụng = đã gán (Status != Available), chưa sử dụng
            // = còn trống (Status == Available). Kết hợp AND với filter Status nếu cả hai được gửi.
            if (request.IsInUse.HasValue)
            {
                query = request.IsInUse.Value
                    ? query.Where(x => x.Status != (int)IpAddressStatus.Available)
                    : query.Where(x => x.Status == (int)IpAddressStatus.Available);
            }

            if (request.DeviceId.HasValue)
            {
                query = query.Where(x => x.DeviceId == request.DeviceId.Value);
            }

            // Materialize projected DTOs then sort by numeric IP value + page in memory: ordering
            // by the IpAddress string in SQL is lexicographic ("10.45.1.10" before "10.45.1.2").
            var all = await _unitOfWork.IpAddresses.ToListAsync(
                query,
                x => new IpAddressDto
                {
                    Id = x.Id,
                    IpAddress = x.IpAddress1,
                    DeviceId = x.DeviceId,
                    // Status = AssignedExternal (1) → hiển thị "Khác" (gán cho thiết bị ngoài,
                    // không có DeviceId); Assigned (2) → mã thiết bị thật; Available (0) → null.
                    DeviceCode = x.Status == (int)IpAddressStatus.AssignedExternal ? "Khác"
                        : x.Device != null ? x.Device.DeviceCode : null,
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
                        : x.Status == (int)IpAddressStatus.AssignedExternal ? "Đã gán (khác)"
                        : x.Status == (int)IpAddressStatus.Assigned ? "Đã gán"
                        : "Không xác định",
                    Note = x.Note
                }
            );

            var ordered = all.OrderBy(x => NetworkHelper.ToSortableKey(x.IpAddress)).ToList();

            var items = ordered
                .Skip((request.PageIndex - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();

            return new PagedResponse<IpAddressDto>(items, ordered.Count, request.PageIndex, request.PageSize);
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

            return ipAddresses.OrderBy(x => NetworkHelper.ToSortableKey(x.IpAddress)).ToList();
        }

        public async Task<IpAddressDto> GetByIdAsync(int id)
        {
            var ipAddress = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.Id == id, x => x.Device, x => x.IpPrefix);
            ipAddress.OrThrowNotFound("Địa chỉ IP", id);

            return MapToDto(ipAddress);
        }

        // Không còn CreateAsync/DeleteAsync thủ công cho từng IpAddress (2026-07-11) — IP chỉ
        // sinh hàng loạt qua IpPrefixService.CreateAsync (255 địa chỉ/prefix) và dọn theo qua
        // IpPrefixService.DeleteAsync. UpdateAsync được giữ lại nhưng CHỈ cho đổi Status +
        // Note (không đổi IpAddress/IpPrefix/DeviceId — xem UpdateIpAddressDto).

        public async Task UpdateAsync(UpdateIpAddressDto request)
        {
            var ipAddress = await _unitOfWork.IpAddresses.GetByIdAsync(request.Id);
            ipAddress.OrThrowNotFound("Địa chỉ IP", request.Id);

            // Chỉ cho đổi Status + Note (2026-07-11, quyết định người dùng). Giữ bất biến
            // Status == Assigned(2) ⟺ DeviceId != null:
            // - IP đang gắn thiết bị (DeviceId != null): không cho đổi Status tay (phải gỡ gán
            //   trước), chỉ đổi được Note.
            // - IP chưa gắn (DeviceId == null): chỉ cho đặt Available(0) hoặc AssignedExternal(1),
            //   không cho đặt Assigned(2) vì không có DeviceId.
            if (ipAddress.DeviceId.HasValue)
            {
                if (request.Status != (int)IpAddressStatus.Assigned)
                    throw new DomainException("Địa chỉ IP đang được gán cho thiết bị, vui lòng gỡ gán trước khi đổi trạng thái.");
            }
            else
            {
                if (request.Status != (int)IpAddressStatus.Available && request.Status != (int)IpAddressStatus.AssignedExternal)
                    throw new DomainException("Chỉ được đặt trạng thái 'Chưa gán' hoặc 'Đã gán (khác)' khi địa chỉ IP chưa gắn thiết bị.");

                ipAddress.Status = request.Status;
            }

            ipAddress.Note = request.Note;

            _unitOfWork.IpAddresses.Update(ipAddress);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task AssignToDeviceAsync(int id, AssignIpAddressDto request)
        {
            var ipAddress = await _unitOfWork.IpAddresses.GetByIdAsync(id);
            ipAddress.OrThrowNotFound("Địa chỉ IP", id);

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
            DeviceId = ipAddress.DeviceId,
            // AssignedExternal → "Khác"; Assigned → mã thiết bị thật; Available → null.
            DeviceCode = ipAddress.Status == (int)IpAddressStatus.AssignedExternal ? "Khác" : ipAddress.Device?.DeviceCode,
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
            (int)IpAddressStatus.AssignedExternal => "Đã gán (khác)",
            (int)IpAddressStatus.Assigned => "Đã gán",
            _ => "Không xác định"
        };
    }
}
