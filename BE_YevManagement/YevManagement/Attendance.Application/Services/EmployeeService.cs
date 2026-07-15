using Attendance.Application.Dtos.Employees;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    public class EmployeeService : BaseService<IAttendanceUnitOfWork>, IEmployeeService
    {
        public EmployeeService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.Employees.GetQueryable(false, x => x.Group).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.Code.Contains(keyword) || x.FirstName.Contains(keyword) || x.LastName.Contains(keyword));
            }

            return await _unitOfWork.Employees.ToPagedResponseAsync(
                query.OrderBy(x => x.Code),
                pageIndex,
                pageSize,
                x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group.GroupNameVn
                }
            );
        }

        // Dùng cho Trưởng Group liệt kê/chọn hàng loạt nhân viên nhóm mình khi lập OtForm.
        public async Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId)
        {
            var items = await _unitOfWork.Employees.SelectAsync(
                predicate: x => !x.IsDeleted && x.GroupId == groupId,
                selector: x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group.GroupNameVn
                }
            );
            return items.OrderBy(x => x.Code).ToList();
        }

        public async Task<EmployeeDto> GetByIdAsync(int id)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Id == id, x => x.Group);
            employee.OrThrowNotFound("Nhân viên", id);

            return new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                MonthToDate = employee.MonthToDate,
                YearToDate = employee.YearToDate,
                GroupId = employee.GroupId,
                GroupNameVn = employee.Group.GroupNameVn
            };
        }

        public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto request)
        {
            var group = await _unitOfWork.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId && !x.IsDeleted);
            group.OrThrowNotFound("Nhóm", request.GroupId);

            var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhân viên '{request.Code}' đã tồn tại.");

            var newEmployee = new Employee
            {
                Code = request.Code,
                FirstName = request.FirstName,
                LastName = request.LastName,
                MonthToDate = request.MonthToDate,
                YearToDate = request.YearToDate,
                GroupId = request.GroupId,
                IsDeleted = false
            };

            await _unitOfWork.Employees.AddAsync(newEmployee);
            await _unitOfWork.SaveChangesAsync();

            return new EmployeeDto
            {
                Id = newEmployee.Id,
                Code = newEmployee.Code,
                FirstName = newEmployee.FirstName,
                LastName = newEmployee.LastName,
                MonthToDate = newEmployee.MonthToDate,
                YearToDate = newEmployee.YearToDate,
                GroupId = newEmployee.GroupId,
                GroupNameVn = group!.GroupNameVn
            };
        }

        public async Task UpdateAsync(UpdateEmployeeDto request)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(request.Id);
            employee.OrThrowNotFound("Nhân viên", request.Id);

            if (employee!.Code != request.Code)
            {
                var exists = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == request.Code && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã nhân viên '{request.Code}' đã tồn tại.");
            }

            if (employee.GroupId != request.GroupId)
            {
                var group = await _unitOfWork.Groups.GetByIdAsync(request.GroupId);
                group.OrThrowNotFound("Nhóm", request.GroupId);
            }

            employee.Code = request.Code;
            employee.FirstName = request.FirstName;
            employee.LastName = request.LastName;
            employee.MonthToDate = request.MonthToDate;
            employee.YearToDate = request.YearToDate;
            employee.GroupId = request.GroupId;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(id);
            employee.OrThrowNotFound("Nhân viên", id);

            employee!.IsDeleted = true;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
