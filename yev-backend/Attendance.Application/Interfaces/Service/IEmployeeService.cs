using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeService
    {
        Task<PagedResponse<EmployeeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword, int? departmentId, int? groupId);

        // Nhân viên trong phạm vi quản lý của người GIỮ QUYỀN DUYỆT (không nhất thiết có Employee.View)
        // — dùng cho màn "Lũy kế nhân viên" tra cứu. Xem chi tiết phạm vi ở EmployeeService.GetInScopeAsync.
        Task<PagedResponse<EmployeeDto>> GetInScopeAsync(string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword);

        // Lịch sử lũy kế 12 tháng của 1 năm — cùng phạm vi truy cập với GetInScopeAsync.
        Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryAsync(string callerUserName, bool isAdmin, int employeeId, int year);
        Task<List<EmployeeDto>> GetAllActiveAsync();

        // targetDate = ngày trên đơn OT đang tạo — Dự kiến (ProjectedMonthToDate/YearToDate) scope theo
        // đúng tháng/năm của targetDate, không phải hôm nay thực tế (mặc định hôm nay nếu bỏ trống).
        Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId, DateOnly? targetDate = null);
        // Toàn bộ nhân viên active thuộc Phòng ban (mọi Group con) — dùng cho màn "Cây duyệt Phòng ban"
        // để xem ai đang giữ Chức vụ nào và gán nhanh Chức vụ ngay tại đó.
        Task<List<EmployeeDto>> GetByDepartmentIdAsync(int departmentId);
        Task<EmployeeDto> GetByIdAsync(int id);
        Task<EmployeeDto> GetByUserNameAsync(string userName);
        Task<EmployeeDto> CreateAsync(CreateEmployeeDto request);
        Task UpdateAsync(UpdateEmployeeDto request);
        Task DeleteAsync(int id);

        // Tính lại TOÀN BỘ permission tự động cấp (theo Chức vụ + theo vai trò "Người phụ trách Cây
        // duyệt") cho 1 Employee rồi đồng bộ vào Identity — gọi từ DepartmentApprovalStepCoordinatorService/
        // GroupApprovalStepCoordinatorService.ReplaceAsync mỗi khi danh sách người phụ trách đổi, để
        // permission có hiệu lực NGAY (nếu Employee đã liên kết UserName) mà không đụng tới phần đồng
        // bộ theo Chức vụ đang có. No-op nếu Employee chưa liên kết UserName — lần UpdateAsync liên
        // kết UserName sau này sẽ tự cấp đúng bộ quyền hiện hành.
        Task SyncAutoGrantedPermissionsForEmployeeAsync(int employeeId);

        // Gán/gỡ Chức vụ CÓ PHẠM VI (2026-08-11c) — khác PUT /{id} (UpdateAsync, sửa toàn bộ hồ sơ,
        // chỉ Admin qua Attendance.Employee.Update): 2 hàm này gọi bởi CẢ Admin lẫn Người phụ trách Cây
        // duyệt (Attendance.DepartmentApprovalStep.Update/GroupApprovalStep.Update — đã tự động cấp
        // cho họ, xem SyncAutoGrantedPermissionsCoreAsync), nhưng non-Admin CHỈ gán được cho Employee
        // đang thuộc ĐÚNG Bộ phận/Nhóm mình phụ trách, và KHÔNG được thăng lên Trưởng Xưởng/Giám đốc
        // (2 chức vụ dùng chung toàn công ty, vượt phạm vi 1 Bộ phận). Tự tính lại GroupId/DepartmentId
        // theo TerminalLevel của Chức vụ mới (không nhận trực tiếp từ client) — mirror
        // ApprovalStepManager.tsx.handleAssignDeptJobTitle/handleAssignGroupJobTitle nhưng validate lại
        // ở BE, không tin client.
        Task<EmployeeDto> AssignDepartmentJobTitleAsync(string userName, bool isAdmin, int employeeId, int departmentId, int? jobTitleId);
        Task<EmployeeDto> AssignGroupJobTitleAsync(string userName, bool isAdmin, int employeeId, int groupId, int? jobTitleId);
    }
}
