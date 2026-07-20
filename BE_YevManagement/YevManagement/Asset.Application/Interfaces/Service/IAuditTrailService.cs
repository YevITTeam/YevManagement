using Asset.Application.Dtos.AuditTrails;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IAuditTrailService
    {
        Task<PagedResponse<AuditTrailDto>> GetPagedAsync(AuditTrailFilterRequest request);
        Task<List<AuditTrailDto>> GetByRecordAsync(string tableName, int recordId);
    }
}
