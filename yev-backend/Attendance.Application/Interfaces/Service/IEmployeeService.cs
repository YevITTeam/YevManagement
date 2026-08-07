using Attendance.Application.Dtos.Employees;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeService
    {
        Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);
        Task<List<EmployeeDto>> GetAllActiveAsync();
        Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId);
        Task<EmployeeDto> GetByIdAsync(int id);
        Task<EmployeeDto> GetByUserNameAsync(string userName);
        Task<EmployeeDto> CreateAsync(CreateEmployeeDto request);
        Task UpdateAsync(UpdateEmployeeDto request);
        Task DeleteAsync(int id);

        // canAdjustAny=true (permission Attendance.Employee.Update) skips the UserName == currentUserName check.
        Task AdjustAccumulationAsync(int employeeId, string currentUserName, bool canAdjustAny, AdjustEmployeeAccumulationDto request);
    }
}
