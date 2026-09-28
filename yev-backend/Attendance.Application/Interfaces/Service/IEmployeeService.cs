using Attendance.Application.Dtos.EmployeeAccumulationHistories;
using Attendance.Application.Dtos.Employees;
using Shared.Application.Wrapper;

namespace Attendance.Application.Interfaces.Service
{
    public interface IEmployeeService
    {
        // Không phải Admin: kết quả tự giới hạn theo phạm vi Cây chức vụ của CHÍNH người gọi (giống
        // GetInScopeAsync bên dưới — Employee.View cấp qua Chức vụ vốn TOÀN CÔNG TY, không tự scope,
        // nên phải chặn lại ở đây để 1 Staff bất kỳ không xem được lũy kế/giới hạn OT của cả công ty).
        Task<PagedResponse<EmployeeDto>> GetPagedAsync(string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword, int? departmentId, int? groupId);

        // Nhân viên trong phạm vi quản lý của người GIỮ QUYỀN DUYỆT (không nhất thiết có Employee.View)
        // — dùng cho màn "Lũy kế nhân viên" tra cứu. Xem chi tiết phạm vi ở EmployeeService.ResolveCallerScopeAsync.
        Task<PagedResponse<EmployeeDto>> GetInScopeAsync(string callerUserName, bool isAdmin, int pageIndex, int pageSize, string? keyword);

        // Lịch sử lũy kế 12 tháng của 1 năm — cùng phạm vi truy cập với GetInScopeAsync.
        Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryAsync(string callerUserName, bool isAdmin, int employeeId, int year);

        // Xem + SỬA TAY lũy kế 1 năm — Admin hoặc Người phụ trách đúng Bộ phận/Nhóm của nhân viên
        // (quyền Attendance.EmployeeAccumulation.Update, scope kiểm ở service).
        Task<EmployeeAccumulationHistoryYearDto> GetAccumulationHistoryForManageAsync(string callerUserName, bool isAdmin, int employeeId, int year);

        Task<EmployeeAccumulationHistoryYearDto> UpdateAccumulationHistoryAsync(string callerUserName, bool isAdmin, int employeeId, UpdateEmployeeAccumulationDto request);

        // Không phải Admin: cũng tự giới hạn theo phạm vi Cây chức vụ của người gọi, cùng lý do với
        // GetPagedAsync ở trên (endpoint "/all" trả nguyên DTO có lũy kế/giới hạn OT, không được để hở).
        Task<List<EmployeeDto>> GetAllActiveAsync(string callerUserName, bool isAdmin);

        // Phạm vi xem nhân viên của người gọi (Admin/company-wide hay giới hạn theo Phòng ban/Nhóm nào)
        // — FE dùng để thu hẹp dropdown lọc ở EmployeeList.tsx, KHÔNG dùng để enforce bảo mật (đã enforce
        // ở GetPagedAsync/GetAllActiveAsync rồi, đây chỉ phục vụ UX).
        Task<EmployeeScopeDto> GetMyScopeAsync(string callerUserName, bool isAdmin);

        // targetDate = ngày trên đơn OT đang tạo — Dự kiến (ProjectedMonthToDate/YearToDate) scope theo
        // đúng tháng/năm của targetDate, không phải hôm nay thực tế (mặc định hôm nay nếu bỏ trống).
        Task<List<EmployeeDto>> GetByGroupIdAsync(int groupId, DateOnly? targetDate = null);
        // Toàn bộ nhân viên active thuộc Phòng ban (mọi Group con) — dùng cho màn "Cây duyệt Phòng ban"
        // để xem ai đang giữ Chức vụ nào và gán nhanh Chức vụ ngay tại đó.
        Task<List<EmployeeDto>> GetByDepartmentIdAsync(int departmentId);
        Task<EmployeeDto> GetByIdAsync(int id);
        Task<EmployeeDto> GetByUserNameAsync(string userName);
        // callerUserName/isAdmin dùng để SCOPE theo Bộ phận/Nhóm phụ trách (2026-09-28, theo yêu cầu
        // người dùng — Coordinator được cấp quyền y hệt Admin nhưng chỉ trong đúng phạm vi mình quản):
        // Create chỉ tạo được vào đúng Bộ phận/Nhóm phụ trách; Update/Delete chỉ tác động được nhân
        // viên hiện thuộc đúng phạm vi, và Update đổi Group/Chức vụ thì phạm vi MỚI cũng phải hợp lệ
        // (không cho "chuyển" nhân viên ra ngoài phạm vi mình quản) — xem
        // EmployeeService.EnsureCanManageDeptOrGroupScopeAsync/EnsureAssignmentInCallerScopeAsync.
        Task<EmployeeDto> CreateAsync(string callerUserName, bool isAdmin, CreateEmployeeDto request);
        Task UpdateAsync(string callerUserName, bool isAdmin, UpdateEmployeeDto request);
        Task DeleteAsync(string callerUserName, bool isAdmin, int id);

        // Tính lại TOÀN BỘ permission tự động cấp (theo Chức vụ + theo vai trò "Người phụ trách Cây
        // duyệt") cho 1 Employee rồi đồng bộ vào Identity — gọi từ DepartmentApprovalStepCoordinatorService/
        // GroupApprovalStepCoordinatorService.ReplaceAsync mỗi khi danh sách người phụ trách đổi, để
        // permission có hiệu lực NGAY (nếu Employee đã liên kết UserName) mà không đụng tới phần đồng
        // bộ theo Chức vụ đang có. No-op nếu Employee chưa liên kết UserName — lần UpdateAsync liên
        // kết UserName sau này sẽ tự cấp đúng bộ quyền hiện hành.
        Task SyncAutoGrantedPermissionsForEmployeeAsync(int employeeId);

        // Chạy lại đúng logic trên cho MỌI Employee đang là Coordinator (Bộ phận hoặc Nhóm) hiện có
        // (2026-09-28) — cần thiết mỗi khi ĐỔI LUẬT cấp tự động trong code (thêm/bớt permission ở
        // SyncAutoGrantedPermissionsCoreAsync), vì cơ chế sync chỉ chạy theo SỰ KIỆN (gán/gỡ Coordinator,
        // sửa quyền theo Chức vụ, liên kết UserName...) — đổi RULE trong code không tự kích hoạt lại cho
        // các Coordinator đã gán từ trước. Trả về số Employee đã đồng bộ lại.
        Task<int> ResyncAllCoordinatorPermissionsAsync();

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

        // Sửa RIÊNG giới hạn OT/tháng/năm (2026-08-29) — permission hẹp Attendance.Employee.UpdateOtLimit,
        // KHÁC Attendance.Employee.Update (UpdateAsync ở trên không còn đụng 2 field này nữa). Non-Admin
        // chỉ sửa được nhân viên thuộc ĐÚNG Phòng ban mình phụ trách (IDepartmentAccessGuard, resolve
        // qua employee.DepartmentId ?? employee.Group.DepartmentId).
        Task<EmployeeDto> UpdateOtLimitAsync(string userName, bool isAdmin, int employeeId, UpdateEmployeeOtLimitDto request);
    }
}
