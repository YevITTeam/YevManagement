using Attendance.Application.Dtos.AuditTrails;
using Attendance.Application.Interfaces.Service;
using Shared.Application.Services;
using Shared.Application.Wrapper;

namespace Attendance.Application.Services
{
    public class AttendanceAuditTrailService : BaseService<IAttendanceUnitOfWork>, IAttendanceAuditTrailService
    {
        public AttendanceAuditTrailService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<AttendanceAuditTrailDto>> GetPagedAsync(AttendanceAuditTrailFilterRequest request)
        {
            var query = _unitOfWork.AttendanceAuditTrails.GetQueryable(false);

            if (!string.IsNullOrWhiteSpace(request.TableName))
                query = query.Where(x => x.TableName == request.TableName);
            if (request.RecordId.HasValue)
                query = query.Where(x => x.RecordId == request.RecordId.Value);
            if (!string.IsNullOrWhiteSpace(request.RecordName))
                query = query.Where(x => x.RecordName != null && x.RecordName.Contains(request.RecordName));
            if (!string.IsNullOrWhiteSpace(request.Action))
                query = query.Where(x => x.Action == request.Action);
            if (!string.IsNullOrWhiteSpace(request.ChangedBy))
                query = query.Where(x => x.ChangedBy.Contains(request.ChangedBy));
            if (request.FromDate.HasValue)
                query = query.Where(x => x.ChangedAt >= request.FromDate.Value);
            // ToDate is a calendar day from the FE, so include all of it.
            if (request.ToDate.HasValue)
                query = query.Where(x => x.ChangedAt < request.ToDate.Value.Date.AddDays(1));

            return await _unitOfWork.AttendanceAuditTrails.ToPagedResponseAsync(
                query.OrderByDescending(x => x.Id),
                request.PageIndex,
                request.PageSize,
                x => new AttendanceAuditTrailDto
                {
                    Id = x.Id,
                    TableName = x.TableName,
                    RecordId = x.RecordId,
                    RecordName = x.RecordName,
                    AffectedCount = x.AffectedCount,
                    Action = x.Action,
                    OldValues = x.OldValues,
                    NewValues = x.NewValues,
                    ChangedBy = x.ChangedBy,
                    ChangedAt = x.ChangedAt
                });
        }
    }
}
