using Asset.Application.Dtos.IpPrefixes;
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

            return await _unitOfWork.IpPrefixes.ToPagedResponseAsync(
                query.OrderBy(x => x.Prefix),
                pageIndex,
                pageSize,
                x => new IpPrefixDto
                {
                    Id = x.Id,
                    Prefix = x.Prefix,
                    SubnetMask = x.SubnetMask,
                    Gateway = x.Gateway,
                    PreferredDns = x.PreferredDns,
                    AlternateDns = x.AlternateDns,
                    Description = x.Description,
                    IpAddressCount = x.IpAddresses.Count(a => !a.IsDeleted)
                }
            );
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
                    IpAddressCount = x.IpAddresses.Count(a => !a.IsDeleted)
                }
            );
            return prefixes.OrderBy(x => x.Prefix).ToList();
        }

        public async Task<IpPrefixDto> GetByIdAsync(int id)
        {
            var prefix = await _unitOfWork.IpPrefixes.GetByIdAsync(id);
            prefix.OrThrowNotFound("Prefix", id);

            var ipAddressCount = (await _unitOfWork.IpAddresses.FindAsync(x => x.IpPrefixId == id && !x.IsDeleted)).Count;

            return new IpPrefixDto
            {
                Id = prefix.Id,
                Prefix = prefix.Prefix,
                SubnetMask = prefix.SubnetMask,
                Gateway = prefix.Gateway,
                PreferredDns = prefix.PreferredDns,
                AlternateDns = prefix.AlternateDns,
                Description = prefix.Description,
                IpAddressCount = ipAddressCount
            };
        }

        public async Task<IpPrefixDto> CreateAsync(CreateIpPrefixDto request)
        {
            // IX_TienToIPs_TienTo là unique index toàn cục trên DB (không lọc IsDeleted)
            var exists = await _unitOfWork.IpPrefixes.FirstOrDefaultAsync(x => x.Prefix == request.Prefix);
            if (exists != null) throw new DomainException($"Prefix '{request.Prefix}' đã tồn tại.");

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
                IpAddressCount = childAddresses.Count
            };
        }

        public async Task UpdateAsync(UpdateIpPrefixDto request)
        {
            var prefix = await _unitOfWork.IpPrefixes.GetByIdAsync(request.Id);
            prefix.OrThrowNotFound("Prefix", request.Id);

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
            var prefix = await _unitOfWork.IpPrefixes.GetByIdAsync(id);
            prefix.OrThrowNotFound("Prefix", id);

            var remainingCount = (await _unitOfWork.IpAddresses.FindAsync(x => x.IpPrefixId == id && !x.IsDeleted)).Count;
            if (remainingCount > 0)
                throw new DomainException($"Còn {remainingCount} địa chỉ IP thuộc prefix này, vui lòng xoá hết IP con trước.");

            prefix.IsDeleted = true;

            _unitOfWork.IpPrefixes.Update(prefix);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
