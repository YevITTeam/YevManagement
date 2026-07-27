using Attendance.Application.Dtos.Departments;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class DepartmentService : BaseService<IAttendanceUnitOfWork>, IDepartmentService
    {
        public DepartmentService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<DepartmentDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Departments.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.DepartmentCode.Contains(keyword) || x.DepartmentNameVn.Contains(keyword));
            }

            return await _unitOfWork.Departments.ToPagedResponseAsync(
                query.OrderBy(x => x.DepartmentCode),
                pageIndex,
                pageSize,
                x => new DepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentNameVn = x.DepartmentNameVn, DepartmentNameJp = x.DepartmentNameJp }
            );
        }

        public async Task<List<DepartmentDto>> GetAllActiveAsync()
        {
            var items = await _unitOfWork.Departments.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new DepartmentDto { Id = x.Id, DepartmentCode = x.DepartmentCode, DepartmentNameVn = x.DepartmentNameVn, DepartmentNameJp = x.DepartmentNameJp }
            );
            return items.OrderBy(x => x.DepartmentNameVn).ToList();
        }

        public async Task<DepartmentDto> GetByIdAsync(int id)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(id);
            department.OrThrowNotFound("Bộ phận", id);

            return new DepartmentDto { Id = department.Id, DepartmentCode = department.DepartmentCode, DepartmentNameVn = department.DepartmentNameVn, DepartmentNameJp = department.DepartmentNameJp };
        }

        public async Task<DepartmentDto> CreateAsync(CreateDepartmentDto request)
        {
            var exists = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.DepartmentCode == request.DepartmentCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã bộ phận '{request.DepartmentCode}' đã tồn tại.");

            var newDepartment = new Department
            {
                DepartmentCode = request.DepartmentCode,
                DepartmentNameVn = request.DepartmentNameVn,
                DepartmentNameJp = request.DepartmentNameJp,
                IsDeleted = false
            };

            await _unitOfWork.Departments.AddAsync(newDepartment);
            await _unitOfWork.SaveChangesAsync();

            return new DepartmentDto { Id = newDepartment.Id, DepartmentCode = newDepartment.DepartmentCode, DepartmentNameVn = newDepartment.DepartmentNameVn, DepartmentNameJp = newDepartment.DepartmentNameJp };
        }

        public async Task UpdateAsync(UpdateDepartmentDto request)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(request.Id);
            department.OrThrowNotFound("Bộ phận", request.Id);

            if (department.DepartmentCode != request.DepartmentCode)
            {
                var exists = await _unitOfWork.Departments.FirstOrDefaultAsync(x => x.DepartmentCode == request.DepartmentCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã bộ phận '{request.DepartmentCode}' đã tồn tại.");
            }

            department.DepartmentCode = request.DepartmentCode;
            department.DepartmentNameVn = request.DepartmentNameVn;
            department.DepartmentNameJp = request.DepartmentNameJp;

            _unitOfWork.Departments.Update(department);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(id);
            department.OrThrowNotFound("Bộ phận", id);

            department.IsDeleted = true;

            _unitOfWork.Departments.Update(department);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
