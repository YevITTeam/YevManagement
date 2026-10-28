using Attendance.Application.Dtos.Workshops;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class WorkshopService : BaseService<IAttendanceUnitOfWork>, IWorkshopService
    {
        public WorkshopService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        private static WorkshopDto ToDto(Workshop x) => new()
        {
            Id = x.Id,
            WorkshopCode = x.WorkshopCode,
            WorkshopNameVn = x.WorkshopNameVn,
            WorkshopNameJp = x.WorkshopNameJp
        };

        public async Task<PagedResponse<WorkshopDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Workshops.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
                query = query.Where(x => x.WorkshopCode.Contains(keyword) || x.WorkshopNameVn.Contains(keyword));

            return await _unitOfWork.Workshops.ToPagedResponseAsync(
                query.OrderBy(x => x.WorkshopCode),
                pageIndex,
                pageSize,
                x => new WorkshopDto { Id = x.Id, WorkshopCode = x.WorkshopCode, WorkshopNameVn = x.WorkshopNameVn, WorkshopNameJp = x.WorkshopNameJp });
        }

        public async Task<List<WorkshopDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.Workshops.FindAsync(x => !x.IsDeleted);
            return items.OrderBy(x => x.WorkshopCode).Select(ToDto).ToList();
        }

        public async Task<WorkshopDto> GetByIdAsync(int id)
        {
            var workshop = await _unitOfWork.Workshops.GetByIdAsync(id);
            workshop.OrThrowNotFound("Xưởng", id);
            return ToDto(workshop!);
        }

        public async Task<WorkshopDto> CreateAsync(CreateWorkshopDto request)
        {
            var exists = await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.WorkshopCode == request.WorkshopCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã xưởng '{request.WorkshopCode}' đã tồn tại.");

            var workshop = new Workshop
            {
                WorkshopCode = request.WorkshopCode,
                WorkshopNameVn = request.WorkshopNameVn,
                WorkshopNameJp = request.WorkshopNameJp,
                IsDeleted = false
            };

            await _unitOfWork.Workshops.AddAsync(workshop);
            await _unitOfWork.SaveChangesAsync();
            return ToDto(workshop);
        }

        public async Task UpdateAsync(UpdateWorkshopDto request)
        {
            var workshop = await _unitOfWork.Workshops.GetByIdAsync(request.Id);
            workshop.OrThrowNotFound("Xưởng", request.Id);

            if (workshop!.WorkshopCode != request.WorkshopCode)
            {
                var exists = await _unitOfWork.Workshops.FirstOrDefaultAsync(x => x.WorkshopCode == request.WorkshopCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã xưởng '{request.WorkshopCode}' đã tồn tại.");
            }

            workshop.WorkshopCode = request.WorkshopCode;
            workshop.WorkshopNameVn = request.WorkshopNameVn;
            workshop.WorkshopNameJp = request.WorkshopNameJp;

            _unitOfWork.Workshops.Update(workshop);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var workshop = await _unitOfWork.Workshops.GetByIdAsync(id);
            workshop.OrThrowNotFound("Xưởng", id);

            var hasGroups = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.WorkshopId == id && !x.IsDeleted);
            if (hasGroups != null) throw new DomainException("Xưởng còn nhóm đang hoạt động, không thể xóa.");

            workshop!.IsDeleted = true;
            _unitOfWork.Workshops.Update(workshop);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
