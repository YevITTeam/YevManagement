using Asset.Application.Dtos.AuditTrails;
using Asset.Application.Interfaces.Service;
using Shared.Application.Services;
using Shared.Application.Wrapper;

namespace Asset.Application.Services
{
    public class AuditTrailService : BaseService<IAssetUnitOfWork>, IAuditTrailService
    {
        public AuditTrailService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<AuditTrailDto>> GetPagedAsync(AuditTrailFilterRequest request)
        {
            var query = _unitOfWork.AuditTrails.GetQueryable(false);

            if (!string.IsNullOrWhiteSpace(request.TableName))
            {
                query = query.Where(x => x.TableName == request.TableName);
            }

            if (request.RecordId.HasValue)
            {
                query = query.Where(x => x.RecordId == request.RecordId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Action))
            {
                query = query.Where(x => x.Action == request.Action);
            }

            if (!string.IsNullOrWhiteSpace(request.ChangedBy))
            {
                query = query.Where(x => x.ChangedBy.Contains(request.ChangedBy));
            }

            if (request.FromDate.HasValue)
            {
                query = query.Where(x => x.ChangedAt >= request.FromDate.Value);
            }

            if (request.ToDate.HasValue)
            {
                query = query.Where(x => x.ChangedAt <= request.ToDate.Value);
            }

            query = query.OrderByDescending(x => x.ChangedAt);

            return await _unitOfWork.AuditTrails.ToPagedResponseAsync(
                query,
                request.PageIndex,
                request.PageSize,
                x => new AuditTrailDto
                {
                    Id = x.Id,
                    TableName = x.TableName,
                    RecordId = x.RecordId,
                    Action = x.Action,
                    OldValues = x.OldValues,
                    NewValues = x.NewValues,
                    ChangedBy = x.ChangedBy,
                    ChangedAt = x.ChangedAt
                });
        }

        public async Task<List<AuditTrailDto>> GetByRecordAsync(string tableName, int recordId)
        {
            var query = _unitOfWork.AuditTrails.GetQueryable(false)
                .Where(x => x.TableName == tableName && x.RecordId == recordId)
                .OrderByDescending(x => x.ChangedAt);

            return await _unitOfWork.AuditTrails.ToListAsync(
                query,
                x => new AuditTrailDto
                {
                    Id = x.Id,
                    TableName = x.TableName,
                    RecordId = x.RecordId,
                    Action = x.Action,
                    OldValues = x.OldValues,
                    NewValues = x.NewValues,
                    ChangedBy = x.ChangedBy,
                    ChangedAt = x.ChangedAt
                });
        }
    }
}
