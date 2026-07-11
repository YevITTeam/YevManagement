using Asset.Application.Dtos.IpPrefixes;
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
    public class IpPrefixService : BaseService<IAssetUnitOfWork>, IIpPrefixService
    {
        public IpPrefixService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<IpPrefixDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.IpPrefixes.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Prefix.Contains(keyword)
                    || (x.Description != null && x.Description.Contains(keyword)));
            }

            // Materialize the projection then sort by numeric IP value + page in memory: ordering
            // by the Prefix string in SQL is lexicographic ("10.45.10" before "10.45.2"). The
            // IpPrefix table is small (a few tens of rows) so in-memory paging here is cheap.
            var all = await _unitOfWork.IpPrefixes.ToListAsync(query, x => new IpPrefixDto
            {
                Id = x.Id,
                Prefix = x.Prefix,
                SubnetMask = x.SubnetMask,
                Gateway = x.Gateway,
                PreferredDns = x.PreferredDns,
                AlternateDns = x.AlternateDns,
                Description = x.Description,
                UsedIpCount = x.IpAddresses.Count(a => !a.IsDeleted && a.Status != (int)IpAddressStatus.Available),
                AvailableIpCount = x.IpAddresses.Count(a => !a.IsDeleted && a.Status == (int)IpAddressStatus.Available)
            });

            var ordered = all.OrderBy(x => NetworkHelper.ToSortableKey(x.Prefix)).ToList();

            var items = ordered
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return new PagedResponse<IpPrefixDto>(items, ordered.Count, pageIndex, pageSize);
        }

        public async Task<List<IpPrefixDto>> GetAllActiveAsync()
        {
            var prefixes = await _unitOfWork.IpPrefixes.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new IpPrefixDto
                {
                    Id = x.Id,
                    Prefix = x.Prefix,
                    SubnetMask = x.SubnetMask,
                    Gateway = x.Gateway,
                    PreferredDns = x.PreferredDns,
                    AlternateDns = x.AlternateDns,
                    Description = x.Description,
                    UsedIpCount = x.IpAddresses.Count(a => !a.IsDeleted && a.Status != (int)IpAddressStatus.Available),
                    AvailableIpCount = x.IpAddresses.Count(a => !a.IsDeleted && a.Status == (int)IpAddressStatus.Available)
                }
            );
            return prefixes.OrderBy(x => NetworkHelper.ToSortableKey(x.Prefix)).ToList();
        }

        public async Task<IpPrefixDto> GetByIdAsync(int id)
        {
            var prefix = await _unitOfWork.IpPrefixes.GetByIdAsync(id);
            prefix.OrThrowNotFound("Prefix", id);

            var childAddresses = await _unitOfWork.IpAddresses.FindAsync(x => x.IpPrefixId == id && !x.IsDeleted);
            var usedCount = childAddresses.Count(x => x.Status != (int)IpAddressStatus.Available);
            var availableCount = childAddresses.Count(x => x.Status == (int)IpAddressStatus.Available);

            return new IpPrefixDto
            {
                Id = prefix.Id,
                Prefix = prefix.Prefix,
                SubnetMask = prefix.SubnetMask,
                Gateway = prefix.Gateway,
                PreferredDns = prefix.PreferredDns,
                AlternateDns = prefix.AlternateDns,
                Description = prefix.Description,
                UsedIpCount = usedCount,
                AvailableIpCount = availableCount
            };
        }

        public async Task<IpPrefixDto> CreateAsync(CreateIpPrefixDto request)
        {
            // IX_TienToIPs_TienTo là unique index toàn cục trên DB (không lọc IsDeleted).
            // (Đây cũng chính là quy tắc "không cho 2 dải mạng trùng network 3-octet" trong
            //  công cụ ChangeIP — GetNetworkClass duplicate check — đã được unique index lo.)
            var exists = await _unitOfWork.IpPrefixes.FirstOrDefaultAsync(x => x.Prefix == request.Prefix);
            if (exists != null) throw new DomainException($"Prefix '{request.Prefix}' đã tồn tại.");

            ValidateNetworkSettings(request);

            var newPrefix = new IpPrefix
            {
                Prefix = request.Prefix,
                SubnetMask = request.SubnetMask,
                Gateway = request.Gateway,
                PreferredDns = request.PreferredDns,
                AlternateDns = request.AlternateDns,
                Description = request.Description,
                IsDeleted = false
            };

            await _unitOfWork.IpPrefixes.AddAsync(newPrefix);
            await _unitOfWork.SaveChangesAsync();

            var childAddresses = Enumerable.Range(1, 255)
                .Select(n => new IpAddress
                {
                    IpAddress1 = $"{request.Prefix}.{n}",
                    IpPrefixId = newPrefix.Id,
                    Status = (int)IpAddressStatus.Available,
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.IpAddresses.AddRangeAsync(childAddresses);
            await _unitOfWork.SaveChangesAsync();

            return new IpPrefixDto
            {
                Id = newPrefix.Id,
                Prefix = newPrefix.Prefix,
                SubnetMask = newPrefix.SubnetMask,
                Gateway = newPrefix.Gateway,
                PreferredDns = newPrefix.PreferredDns,
                AlternateDns = newPrefix.AlternateDns,
                Description = newPrefix.Description,
                // Vừa sinh xong nên toàn bộ IP con đều Available (chưa sử dụng).
                UsedIpCount = 0,
                AvailableIpCount = childAddresses.Count
            };
        }

        // Validate cấu hình mạng khi tạo dải (2026-07-11) — áp dụng logic từ công cụ ChangeIP
        // nội bộ (SetIP.cs), dùng NetworkHelper: mọi field IP nhập vào (SubnetMask/Gateway/
        // PreferredDns/AlternateDns) nếu có phải là IPv4 hợp lệ; Gateway phải nằm cùng subnet
        // với dải IP sẽ sinh (prefix.1..prefix.255) và không được trùng địa chỉ network/broadcast.
        private static void ValidateNetworkSettings(CreateIpPrefixDto request)
        {
            if (!string.IsNullOrWhiteSpace(request.SubnetMask) && !NetworkHelper.IsValidIpv4(request.SubnetMask))
                throw new DomainException($"Subnet Mask '{request.SubnetMask}' không hợp lệ.");

            if (!string.IsNullOrWhiteSpace(request.PreferredDns) && !NetworkHelper.IsValidIpv4(request.PreferredDns))
                throw new DomainException($"Preferred DNS '{request.PreferredDns}' không hợp lệ.");

            if (!string.IsNullOrWhiteSpace(request.AlternateDns) && !NetworkHelper.IsValidIpv4(request.AlternateDns))
                throw new DomainException($"Alternate DNS '{request.AlternateDns}' không hợp lệ.");

            if (!string.IsNullOrWhiteSpace(request.Gateway))
            {
                if (!NetworkHelper.IsValidIpv4(request.Gateway))
                    throw new DomainException($"Gateway '{request.Gateway}' không hợp lệ.");

                // Gateway phải thuộc đúng network 3-octet của prefix (dải IP con là prefix.1..255).
                if (!string.Equals(NetworkHelper.GetNetworkClass(request.Gateway), request.Prefix, StringComparison.OrdinalIgnoreCase))
                    throw new DomainException($"Gateway '{request.Gateway}' không nằm trong dải mạng '{request.Prefix}'.");

                // Nếu có SubnetMask, kiểm tra chặt hơn bằng bitwise AND (Gateway cùng subnet với dải).
                if (!string.IsNullOrWhiteSpace(request.SubnetMask) &&
                    !NetworkHelper.IsSameSubnet($"{request.Prefix}.1", request.Gateway, request.SubnetMask))
                    throw new DomainException($"Gateway '{request.Gateway}' không cùng subnet với dải mạng '{request.Prefix}' theo Subnet Mask '{request.SubnetMask}'.");

                // Gateway không được trùng địa chỉ network (.0) hay broadcast (.255) của dải.
                if (request.Gateway.Trim() == $"{request.Prefix}.0" || request.Gateway.Trim() == $"{request.Prefix}.255")
                    throw new DomainException($"Gateway '{request.Gateway}' không được trùng địa chỉ network/broadcast của dải mạng.");
            }
        }

        // Không còn UpdateAsync cho IpPrefix (2026-07-11, quyết định người dùng) — IpPrefix
        // chỉ được Create/Delete, không cho sửa Prefix/SubnetMask/Gateway/DNS sau khi tạo.

        public async Task DeleteAsync(int id)
        {
            var prefix = await _unitOfWork.IpPrefixes.GetByIdAsync(id);
            prefix.OrThrowNotFound("Prefix", id);

            var childAddresses = await _unitOfWork.IpAddresses.FindAsync(x => x.IpPrefixId == id && !x.IsDeleted);

            // 2026-07-11 (quyết định người dùng): không còn API xoá tay từng IpAddress, nên
            // chỉ chặn xoá Prefix nếu còn IP con ĐANG GẮN cho Device (khác quy tắc cũ — chặn
            // hễ còn bất kỳ IP con nào chưa xoá, điều này giờ luôn đúng vì IP không tự xoá
            // được nữa). IP con chưa dùng (DeviceId null) tự cascade soft-delete theo Prefix.
            var inUseAddresses = childAddresses.Where(x => x.DeviceId.HasValue).ToList();
            if (inUseAddresses.Count > 0)
                throw new DomainException($"Còn {inUseAddresses.Count} địa chỉ IP thuộc prefix này đang được gán cho thiết bị, vui lòng gỡ gán trước khi xoá.");

            foreach (var address in childAddresses)
            {
                address.IsDeleted = true;
                _unitOfWork.IpAddresses.Update(address);
            }

            prefix.IsDeleted = true;
            _unitOfWork.IpPrefixes.Update(prefix);

            await _unitOfWork.SaveChangesAsync();
        }
    }
}
