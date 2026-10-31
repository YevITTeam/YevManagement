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
            // `Branch` is an optional navigation — see the note in IpAddressService.GetPagedAsync.
            var query = _unitOfWork.IpPrefixes.GetQueryable(false, x => x.Branch!).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Prefix.Contains(keyword)
                    || (x.Description != null && x.Description.Contains(keyword)));
            }

            // Sort numerically in memory: SQL string order puts "10.45.10" before "10.45.2"; the table is small.
            var all = await _unitOfWork.IpPrefixes.ToListAsync(query, x => new IpPrefixDto
            {
                Id = x.Id,
                Prefix = x.Prefix,
                BranchId = x.BranchId,
                BranchName = x.Branch != null ? x.Branch.BranchName : null,
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
                    BranchId = x.BranchId,
                    BranchName = x.Branch != null ? x.Branch.BranchName : null,
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
            var prefix = (await _unitOfWork.IpPrefixes.FirstOrDefaultAsync(x => x.Id == id, x => x.Branch!)).OrThrowNotFound("Prefix", id);

            var childAddresses = await _unitOfWork.IpAddresses.FindAsync(x => x.IpPrefixId == id && !x.IsDeleted);
            var usedCount = childAddresses.Count(x => x.Status != (int)IpAddressStatus.Available);
            var availableCount = childAddresses.Count(x => x.Status == (int)IpAddressStatus.Available);

            return new IpPrefixDto
            {
                Id = prefix!.Id,
                Prefix = prefix.Prefix,
                BranchId = prefix.BranchId,
                BranchName = prefix.Branch?.BranchName,
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
            // IX_TienToIPs_TienTo is a global unique index (not filtered by IsDeleted), so it also blocks duplicate ranges.
            var exists = await _unitOfWork.IpPrefixes.FirstOrDefaultAsync(x => x.Prefix == request.Prefix);
            if (exists != null) throw new DomainException($"Prefix '{request.Prefix}' đã tồn tại.");

            var branch = await ValidateBranchIdAsync(request.BranchId);

            ValidateNetworkSettings(request.Prefix, request.SubnetMask, request.Gateway, request.PreferredDns, request.AlternateDns);

            var newPrefix = new IpPrefix
            {
                Prefix = request.Prefix,
                BranchId = request.BranchId,
                SubnetMask = request.SubnetMask,
                Gateway = request.Gateway,
                PreferredDns = request.PreferredDns,
                AlternateDns = request.AlternateDns,
                Description = request.Description,
                IsDeleted = false
            };

            await _unitOfWork.IpPrefixes.AddAsync(newPrefix);
            await _unitOfWork.SaveChangesAsync();

            // Skip .0 (network) and .255 (broadcast), leaving .1..254.
            var childAddresses = Enumerable.Range(1, 254)
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
                BranchId = newPrefix.BranchId,
                BranchName = branch.BranchName,
                SubnetMask = newPrefix.SubnetMask,
                Gateway = newPrefix.Gateway,
                PreferredDns = newPrefix.PreferredDns,
                AlternateDns = newPrefix.AlternateDns,
                Description = newPrefix.Description,
                // Just generated, so all child IPs are Available (not used yet).
                UsedIpCount = 0,
                AvailableIpCount = childAddresses.Count
            };
        }

        private async Task<Branch> ValidateBranchIdAsync(int branchId)
        {
            var branch = (await _unitOfWork.Branches.FirstOrDefaultAsync(x => x.Id == branchId && !x.IsDeleted)).OrThrowNotFound("Chi nhánh", branchId);
            return branch!;
        }

        // Every IP field, if provided, must be a valid IPv4; Gateway must be inside prefix.1..254 and not the
        // network/broadcast address. Takes raw values because Update has no Prefix field.
        private static void ValidateNetworkSettings(string prefix, string? subnetMask, string? gateway, string? preferredDns, string? alternateDns)
        {
            if (!string.IsNullOrWhiteSpace(subnetMask) && !NetworkHelper.IsValidIpv4(subnetMask))
                throw new DomainException($"Subnet Mask '{subnetMask}' không hợp lệ.");

            if (!string.IsNullOrWhiteSpace(preferredDns) && !NetworkHelper.IsValidIpv4(preferredDns))
                throw new DomainException($"Preferred DNS '{preferredDns}' không hợp lệ.");

            if (!string.IsNullOrWhiteSpace(alternateDns) && !NetworkHelper.IsValidIpv4(alternateDns))
                throw new DomainException($"Alternate DNS '{alternateDns}' không hợp lệ.");

            if (!string.IsNullOrWhiteSpace(gateway))
            {
                if (!NetworkHelper.IsValidIpv4(gateway))
                    throw new DomainException($"Gateway '{gateway}' không hợp lệ.");

                // Gateway must belong to the exact 3-octet network of the prefix (the child IP range is prefix.1..254).
                if (!string.Equals(NetworkHelper.GetNetworkClass(gateway), prefix, StringComparison.OrdinalIgnoreCase))
                    throw new DomainException($"Gateway '{gateway}' không nằm trong dải mạng '{prefix}'.");

                // If SubnetMask is provided, apply a stricter check via bitwise AND (Gateway is in the same subnet as the range).
                if (!string.IsNullOrWhiteSpace(subnetMask) &&
                    !NetworkHelper.IsSameSubnet($"{prefix}.1", gateway, subnetMask))
                    throw new DomainException($"Gateway '{gateway}' không cùng subnet với dải mạng '{prefix}' theo Subnet Mask '{subnetMask}'.");

                // Gateway must not match the range's network address (.0) or broadcast address (.255).
                if (gateway.Trim() == $"{prefix}.0" || gateway.Trim() == $"{prefix}.255")
                    throw new DomainException($"Gateway '{gateway}' không được trùng địa chỉ network/broadcast của dải mạng.");
            }
        }

        // Prefix is immutable (254 child IPs already generated); only Branch and network settings can change.
        public async Task UpdateAsync(UpdateIpPrefixDto request)
        {
            var prefix = (await _unitOfWork.IpPrefixes.GetByIdAsync(request.Id)).OrThrowNotFound("Prefix", request.Id);

            var branch = await ValidateBranchIdAsync(request.BranchId);

            ValidateNetworkSettings(prefix!.Prefix, request.SubnetMask, request.Gateway, request.PreferredDns, request.AlternateDns);

            prefix.BranchId = branch.Id;
            prefix.SubnetMask = request.SubnetMask;
            prefix.Gateway = request.Gateway;
            prefix.PreferredDns = request.PreferredDns;
            prefix.AlternateDns = request.AlternateDns;
            prefix.Description = request.Description;

            _unitOfWork.IpPrefixes.Update(prefix);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var prefix = (await _unitOfWork.IpPrefixes.GetByIdAsync(id)).OrThrowNotFound("Prefix", id);

            var childAddresses = await _unitOfWork.IpAddresses.FindAsync(x => x.IpPrefixId == id && !x.IsDeleted);

            // Block deletion only when a child IP is assigned to a Device; unused child IPs are soft-deleted with the Prefix.
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
