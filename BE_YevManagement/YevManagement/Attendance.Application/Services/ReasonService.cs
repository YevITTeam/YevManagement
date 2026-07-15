using Attendance.Application.Dtos.Reasons;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class ReasonService : BaseService<IAttendanceUnitOfWork>, IReasonService
    {
        public ReasonService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<ReasonDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Reasons.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.ReasonNameVn.Contains(keyword));
            }

            return await _unitOfWork.Reasons.ToPagedResponseAsync(
                query.OrderBy(x => x.ReasonNameVn),
                pageIndex,
                pageSize,
                x => new ReasonDto { Id = x.Id, ReasonNameVn = x.ReasonNameVn, ReasonNameJp = x.ReasonNameJp }
            );
        }

        public async Task<List<ReasonDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.Reasons.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new ReasonDto { Id = x.Id, ReasonNameVn = x.ReasonNameVn, ReasonNameJp = x.ReasonNameJp }
            );
            return items.OrderBy(x => x.ReasonNameVn).ToList();
        }

        public async Task<ReasonDto> GetByIdAsync(int id)
        {
            var reason = await _unitOfWork.Reasons.GetByIdAsync(id);
            reason.OrThrowNotFound("Lý do", id);

            return new ReasonDto { Id = reason!.Id, ReasonNameVn = reason.ReasonNameVn, ReasonNameJp = reason.ReasonNameJp };
        }

        public async Task<ReasonDto> CreateAsync(CreateReasonDto request)
        {
            var newReason = new Reason
            {
                ReasonNameVn = request.ReasonNameVn,
                ReasonNameJp = request.ReasonNameJp,
                IsDeleted = false
            };

            await _unitOfWork.Reasons.AddAsync(newReason);
            await _unitOfWork.SaveChangesAsync();

            return new ReasonDto { Id = newReason.Id, ReasonNameVn = newReason.ReasonNameVn, ReasonNameJp = newReason.ReasonNameJp };
        }

        public async Task UpdateAsync(UpdateReasonDto request)
        {
            var reason = await _unitOfWork.Reasons.GetByIdAsync(request.Id);
            reason.OrThrowNotFound("Lý do", request.Id);

            reason!.ReasonNameVn = request.ReasonNameVn;
            reason.ReasonNameJp = request.ReasonNameJp;

            _unitOfWork.Reasons.Update(reason);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var reason = await _unitOfWork.Reasons.GetByIdAsync(id);
            reason.OrThrowNotFound("Lý do", id);

            reason!.IsDeleted = true;

            _unitOfWork.Reasons.Update(reason);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
