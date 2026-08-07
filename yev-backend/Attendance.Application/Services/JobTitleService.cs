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
            TerminalLevel = jobTitle.TerminalLevel
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

        // At most 1 active JobTitle may hold each non-None TerminalLevel (Trưởng phòng/Trưởng
        // Xưởng/Tổng Giám Đốc phải là duy nhất — chuỗi duyệt tự động cần biết chính xác cấp nào là
        // điểm dừng cuối). excludeId dùng khi Update để loại chính bản ghi đang sửa.
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

            var newJobTitle = new JobTitle
            {
                Code = request.Code,
                Name = request.Name,
                RankOrder = request.RankOrder,
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

            jobTitle.Code = request.Code;
            jobTitle.Name = request.Name;
            jobTitle.RankOrder = request.RankOrder;
            jobTitle.TerminalLevel = request.TerminalLevel;

            _unitOfWork.JobTitles.Update(jobTitle);
            await _unitOfWork.SaveChangesAsync();
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
