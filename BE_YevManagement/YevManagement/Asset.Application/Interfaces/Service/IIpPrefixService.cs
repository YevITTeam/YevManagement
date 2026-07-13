using Asset.Application.Dtos.IpPrefixes;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface IIpPrefixService
    {
        Task<PagedResponse<IpPrefixDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<IpPrefixDto>> GetAllActiveAsync();
        Task<IpPrefixDto> GetByIdAsync(int id);
        Task<IpPrefixDto> CreateAsync(CreateIpPrefixDto request);
        Task UpdateAsync(UpdateIpPrefixDto request);
        Task DeleteAsync(int id);
    }
}
