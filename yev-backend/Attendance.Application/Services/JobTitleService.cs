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

            // Cấp độ (RankOrder) không còn nhập tay — chức vụ mới luôn xếp cuối danh sách hiện có, vị
            // trí thật được chỉnh sau đó bằng kéo-thả (ReorderAsync) để tránh phải tự tay dồn số các
            // chức vụ khác khi cần chèn vào giữa.
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

            // RankOrder KHÔNG đụng tới ở đây nữa — chỉ đổi qua ReorderAsync (kéo-thả).
            jobTitle.Code = request.Code;
            jobTitle.Name = request.Name;
            jobTitle.TerminalLevel = request.TerminalLevel;

            _unitOfWork.JobTitles.Update(jobTitle);
            await _unitOfWork.SaveChangesAsync();
        }

        // Kéo-thả xong FE gửi lên TOÀN BỘ Id chức vụ active theo đúng thứ tự mới — validate khớp đúng
        // tập hợp đang có (tránh lệch dữ liệu nếu 1 người khác vừa thêm/xoá chức vụ trong lúc kéo),
        // rồi gán lại RankOrder = 1..N tuần tự theo thứ tự đó.
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
