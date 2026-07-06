using Asset.Application.Dtos.Suplliers;
using Shared.Application.Wrapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface ISupplierService
    {
        Task<PagedResponse<SupplierDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<SupplierDto>> GetAllActiveAsync();
        Task<SupplierDto> GetByIdAsync(int id);
        Task<SupplierDto> CreateAsync(CreateSupplierDto request);
        Task UpdateAsync(UpdateSupplierDto request);
        Task DeleteAsync(int id);
    }
}
