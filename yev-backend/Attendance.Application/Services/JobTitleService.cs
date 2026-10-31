using Attendance.Application.Dtos.JobTitles;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class JobTitleService : BaseService<IAttendanceUnitOfWork>, IJobTitleService
    {
        public JobTitleService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        private static JobTitleDto ToDto(JobTitle jobTitle) => new()
        {
            Id = jobTitle.Id,
            Code = jobTitle.Code,
            Name = jobTitle.Name,
            RankOrder = jobTitle.RankOrder,
            TerminalLevel = jobTitle.TerminalLevel,
            IsLineScoped = jobTitle.IsLineScoped
        };

        public async Task<PagedResponse<JobTitleDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.JobTitles.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword) || x.Name.Contains(keyword));
            }

            return await _unitOfWork.JobTitles.ToPagedResponseAsync(
                query.OrderBy(x => x.RankOrder),
                pageIndex,
                pageSize,
                x => ToDto(x)
            );
        }

        public async Task<List<JobTitleDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.JobTitles.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => x
            );
            return items.OrderBy(x => x.RankOrder).Select(ToDto).ToList();
        }

        public async Task<JobTitleDto> GetByIdAsync(int id)
        {
            var jobTitle = (await _unitOfWork.JobTitles.GetByIdAsync(id)).OrThrowNotFound("Chức vụ", id);
            return ToDto(jobTitle);
        }

        // Each non-None TerminalLevel must be unique so the auto chain knows exactly where it stops.
        private async Task ThrowIfTerminalLevelTaken(int terminalLevel, int? excludeId)
        {
            if (terminalLevel == (int)JobTitleTerminalLevel.None) return;

            var conflict = await _unitOfWork.JobTitles.FirstOrDefaultAsync(
                x => x.TerminalLevel == terminalLevel && !x.IsDeleted && x.Id != (excludeId ?? 0));
            if (conflict != null)
                throw new DomainException($"Cấp duyệt cuối này đã được gán cho chức vụ '{conflict.Name}'.");
        }

        public async Task<JobTitleDto> CreateAsync(CreateJobTitleDto request)
        {
            var exists = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Code == request.Code);
            exists.ThrowIfDuplicateCode("Mã chức vụ", request.Code, x => x.IsDeleted);

            await ThrowIfTerminalLevelTaken(request.TerminalLevel, null);

            // New titles go last; position is set later via drag-and-drop to avoid renumbering others on insert.
            var activeJobTitles = await _unitOfWork.JobTitles.SelectAsync(x => !x.IsDeleted, x => x);
            var nextRankOrder = activeJobTitles.Count == 0 ? 1 : activeJobTitles.Max(x => x.RankOrder) + 1;

            var newJobTitle = new JobTitle
            {
                Code = request.Code,
                Name = request.Name,
                RankOrder = nextRankOrder,
                TerminalLevel = request.TerminalLevel,
                IsDeleted = false
            };

            await _unitOfWork.JobTitles.AddAsync(newJobTitle);
            await _unitOfWork.SaveChangesAsync();

            return ToDto(newJobTitle);
        }

        public async Task UpdateAsync(UpdateJobTitleDto request)
        {
            var jobTitle = (await _unitOfWork.JobTitles.GetByIdAsync(request.Id)).OrThrowNotFound("Chức vụ", request.Id);

            var exists = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Code == request.Code && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã chức vụ", request.Code, x => x.IsDeleted);

            await ThrowIfTerminalLevelTaken(request.TerminalLevel, request.Id);

            // RankOrder changes only via ReorderAsync.
            jobTitle.Code = request.Code;
            jobTitle.Name = request.Name;
            jobTitle.TerminalLevel = request.TerminalLevel;

            _unitOfWork.JobTitles.Update(jobTitle);
            await _unitOfWork.SaveChangesAsync();
        }

        // Must match the current active set exactly, guarding against concurrent add/delete during the drag.
        public async Task<List<JobTitleDto>> ReorderAsync(List<int> jobTitleIds)
        {
            var activeJobTitles = await _unitOfWork.JobTitles.SelectAsync(x => !x.IsDeleted, x => x);

            if (jobTitleIds.Count != activeJobTitles.Count || !jobTitleIds.ToHashSet().SetEquals(activeJobTitles.Select(x => x.Id)))
                throw new DomainException("Danh sách sắp xếp không khớp với danh sách chức vụ hiện tại — vui lòng tải lại trang.");

            var byId = activeJobTitles.ToDictionary(x => x.Id);
            for (var i = 0; i < jobTitleIds.Count; i++)
            {
                var jobTitle = byId[jobTitleIds[i]];
                jobTitle.RankOrder = i + 1;
                _unitOfWork.JobTitles.Update(jobTitle);
            }

            await _unitOfWork.SaveChangesAsync();

            return jobTitleIds.Select(id => ToDto(byId[id])).ToList();
        }

        public async Task DeleteAsync(int id)
        {
            var jobTitle = (await _unitOfWork.JobTitles.GetByIdAsync(id)).OrThrowNotFound("Chức vụ", id);

            var assignedCount = await _unitOfWork.Employees.CountAsync(
                _unitOfWork.Employees.GetQueryable(false), x => x.JobTitleId == id && !x.IsDeleted);
            if (assignedCount > 0)
                throw new DomainException($"Không thể xóa: còn {assignedCount} nhân viên đang giữ chức vụ này.");

            jobTitle.IsDeleted = true;

            _unitOfWork.JobTitles.Update(jobTitle);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
