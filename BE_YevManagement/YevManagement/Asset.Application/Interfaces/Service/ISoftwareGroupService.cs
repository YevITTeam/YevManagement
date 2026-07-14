using Asset.Application.Dtos.SoftwareGroups;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface ISoftwareGroupService
    {
        Task<PagedResponse<SoftwareGroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<SoftwareGroupDto>> GetAllActiveAsync();
        Task<SoftwareGroupDto> GetByIdAsync(int id);
        Task<SoftwareGroupDto> CreateAsync(CreateSoftwareGroupDto request);
        Task UpdateAsync(UpdateSoftwareGroupDto request);
        Task DeleteAsync(int id);
    }
}
