using Asset.Application.Dtos.Softwares;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface ISoftwareService
    {
        Task<PagedResponse<SoftwareDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<SoftwareDto>> GetAllActiveAsync();
        Task<SoftwareDto> GetByIdAsync(int id);
        Task<SoftwareDto> CreateAsync(CreateSoftwareDto request);
        Task UpdateAsync(UpdateSoftwareDto request);
        Task DeleteAsync(int id);
    }
}
