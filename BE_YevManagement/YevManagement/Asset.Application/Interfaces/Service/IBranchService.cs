using Asset.Application.Dtos.Branches;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface IBranchService
    {
        Task<PagedResponse<BranchDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<BranchDto>> GetAllActiveAsync();
        Task<BranchDto> GetByIdAsync(int id);
        Task<BranchDto> CreateAsync(CreateBranchDto request);
        Task UpdateAsync(UpdateBranchDto request);
        Task DeleteAsync(int id);
    }
}
