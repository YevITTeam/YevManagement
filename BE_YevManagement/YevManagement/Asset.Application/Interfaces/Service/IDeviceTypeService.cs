using Asset.Application.Dtos.DeviceTypes;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceTypeService
    {
        Task<PagedResponse<DeviceTypeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<DeviceTypeDto>> GetAllActiveAsync();
        Task<DeviceTypeDto> GetByIdAsync(int id);
        Task<DeviceTypeDto> CreateAsync(CreateDeviceTypeDto request);
        Task UpdateAsync(UpdateDeviceTypeDto request);
        Task DeleteAsync(int id);
    }
}
