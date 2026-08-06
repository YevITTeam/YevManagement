using Attendance.Application.Dtos.Employees;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Shared.Application.Helper;
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
            var orderedQuery = query.OrderBy(x => x.Code);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                // "Họ và tên" hiển thị theo quy ước "{LastName} {FirstName}" (giống OtFormService) —
                // so khớp cả chuỗi ghép để tìm được khi người dùng gõ đủ họ tên, không chỉ từng phần riêng lẻ.
                query = query.Where(x =>
                    x.Code.Contains(keyword) ||
                    x.FirstName.Contains(keyword) ||
                    x.LastName.Contains(keyword) ||
                    (x.LastName + " " + x.FirstName).Contains(keyword));

                // Khớp đúng tuyệt đối Code (vd tìm "50" ra ngay mã "50") được ưu tiên lên đầu,
                // thay vì lẫn giữa các mã chỉ chứa keyword (vd "150", "250", "500").
                orderedQuery = query.OrderBy(x => x.Code == keyword ? 0 : 1).ThenBy(x => x.Code);
            }

            return await _unitOfWork.Employees.ToPagedResponseAsync(
                orderedQuery,
                pageIndex,
                pageSize,
                x => new EmployeeDto
                {
                    Id = x.Id,
                    Code = x.Code,
                    FirstName = x.FirstName,
                    LastName = x.LastName,
                    UserName = x.UserName,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    AccumulationYear = x.AccumulationYear,
                    AccumulationMonth = x.AccumulationMonth,
                    ProjectedMonthToDate = x.ProjectedMonthToDate,
                    ProjectedYearToDate = x.ProjectedYearToDate,
                    GroupId = x.GroupId,
                    GroupNameVn = x.Group.GroupNameVn
                }
            );
        }

        // Dùng cho Trưởng nhóm liệt kê/chọn hàng loạt nhân viên nhóm mình khi lập OtForm.
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
                    UserName = x.UserName,
                    MonthToDate = x.MonthToDate,
                    YearToDate = x.YearToDate,
                    AccumulationYear = x.AccumulationYear,
                    AccumulationMonth = x.AccumulationMonth,
                    ProjectedMonthToDate = x.ProjectedMonthToDate,
                    ProjectedYearToDate = x.ProjectedYearToDate,
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
                UserName = employee.UserName,
                MonthToDate = employee.MonthToDate,
                YearToDate = employee.YearToDate,
                AccumulationYear = employee.AccumulationYear,
                AccumulationMonth = employee.AccumulationMonth,
                ProjectedMonthToDate = employee.ProjectedMonthToDate,
                ProjectedYearToDate = employee.ProjectedYearToDate,
                GroupId = employee.GroupId,
                GroupNameVn = employee.Group.GroupNameVn
            };
        }

        // Nhân viên tự tra employeeId của chính mình (màn "Lũy kế của tôi") — so khớp Employee.UserName.
        public async Task<EmployeeDto> GetByUserNameAsync(string userName)
        {
            var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == userName && !x.IsDeleted, x => x.Group);
            employee.OrThrowNotFound("Nhân viên (tài khoản chưa được gán cho nhân viên nào)", userName);

            return new EmployeeDto
            {
                Id = employee!.Id,
                Code = employee.Code,
                FirstName = employee.FirstName,
                LastName = employee.LastName,
                UserName = employee.UserName,
                MonthToDate = employee.MonthToDate,
                YearToDate = employee.YearToDate,
                AccumulationYear = employee.AccumulationYear,
                AccumulationMonth = employee.AccumulationMonth,
                ProjectedMonthToDate = employee.ProjectedMonthToDate,
                ProjectedYearToDate = employee.ProjectedYearToDate,
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

            if (!string.IsNullOrWhiteSpace(request.UserName))
            {
                var existsUserName = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == request.UserName && !x.IsDeleted);
                if (existsUserName != null) throw new DomainException($"Tài khoản '{request.UserName}' đã được gán cho nhân viên khác.");
            }

            var now = TimeHelper.GetCurrentUtcTime();
            var newEmployee = new Employee
            {
                Code = request.Code,
                FirstName = request.FirstName,
                LastName = request.LastName,
                UserName = request.UserName,
                MonthToDate = request.MonthToDate,
                YearToDate = request.YearToDate,
                AccumulationYear = now.Year,
                AccumulationMonth = now.Month,
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
                UserName = newEmployee.UserName,
                MonthToDate = newEmployee.MonthToDate,
                YearToDate = newEmployee.YearToDate,
                AccumulationYear = newEmployee.AccumulationYear,
                AccumulationMonth = newEmployee.AccumulationMonth,
                ProjectedMonthToDate = newEmployee.ProjectedMonthToDate,
                ProjectedYearToDate = newEmployee.ProjectedYearToDate,
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

            if (!string.IsNullOrWhiteSpace(request.UserName) && employee.UserName != request.UserName)
            {
                var existsUserName = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.UserName == request.UserName && !x.IsDeleted);
                if (existsUserName != null) throw new DomainException($"Tài khoản '{request.UserName}' đã được gán cho nhân viên khác.");
            }

            if (employee.GroupId != request.GroupId)
            {
                var group = await _unitOfWork.Groups.GetByIdAsync(request.GroupId);
                group.OrThrowNotFound("Nhóm", request.GroupId);
            }

            var now = TimeHelper.GetCurrentUtcTime();
            employee.Code = request.Code;
            employee.FirstName = request.FirstName;
            employee.LastName = request.LastName;
            employee.UserName = request.UserName;
            employee.MonthToDate = request.MonthToDate;
            employee.YearToDate = request.YearToDate;
            employee.AccumulationYear = now.Year;
            employee.AccumulationMonth = now.Month;
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

        // Nhân viên tự chỉnh lũy kế của chính mình (canAdjustAny=false, so khớp UserName), hoặc
        // người có quyền Attendance.Employee.Update chỉnh cho bất kỳ ai (canAdjustAny=true).
        public async Task AdjustAccumulationAsync(int employeeId, string currentUserName, bool canAdjustAny, AdjustEmployeeAccumulationDto request)
        {
            var employee = await _unitOfWork.Employees.GetByIdAsync(employeeId);
            employee.OrThrowNotFound("Nhân viên", employeeId);

            if (!canAdjustAny && employee!.UserName != currentUserName)
                throw new DomainException("Bạn không có quyền chỉnh lũy kế của nhân viên này.");

            var now = TimeHelper.GetCurrentUtcTime();
            employee!.MonthToDate = request.MonthToDate;
            employee.YearToDate = request.YearToDate;
            employee.AccumulationYear = now.Year;
            employee.AccumulationMonth = now.Month;

            _unitOfWork.Employees.Update(employee);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
