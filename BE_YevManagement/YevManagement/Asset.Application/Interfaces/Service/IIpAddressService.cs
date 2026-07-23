using Asset.Application.Dtos.IpAddresses;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface IIpAddressService
    {
        Task<PagedResponse<IpAddressDto>> GetPagedAsync(IpAddressFilterRequest request);
        Task<List<IpAddressDto>> GetAvailableAsync(string? keyword);
        Task<IpAddressDto> GetByIdAsync(int id);
        Task UpdateAsync(UpdateIpAddressDto request);
        Task<BulkUpdateIpAddressStatusResultDto> BulkUpdateStatusAsync(BulkUpdateIpAddressStatusRequestDto request);
        Task AssignToDeviceAsync(int id, AssignIpAddressDto request);
        Task UnassignAsync(int id);
    }
}
