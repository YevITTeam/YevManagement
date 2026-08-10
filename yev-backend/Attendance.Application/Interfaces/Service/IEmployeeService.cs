using Attendance.Application.Dtos.Employees;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeService
    {
        Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword, int? departmentId, int? groupId);
        Task<List<EmployeeDto>> GetAllActiveAsync();
        Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId);
        // Toàn bộ nhân viên active thuộc Phòng ban (mọi Group con) — dùng cho màn "Cây duyệt Phòng ban"
        // để xem ai đang giữ Chức vụ nào và gán nhanh Chức vụ ngay tại đó.
        Task<List<EmployeeDto>> GetByDepartmentIdAsync(int departmentId);
        Task<EmployeeDto> GetByIdAsync(int id);
        Task<EmployeeDto> GetByUserNameAsync(string userName);
        Task<EmployeeDto> CreateAsync(CreateEmployeeDto request);
        Task UpdateAsync(UpdateEmployeeDto request);
        Task DeleteAsync(int id);
    }
}
