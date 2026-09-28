namespace Attendance.Domain.Constants;

// Permission tự động cấp cho Employee đang được gán làm "Người phụ trách Cây duyệt" (2026-08-11b) —
// KHÔNG đi qua JobTitlePermissionWhitelist (permission ở đây do code hardcode cố định, không phải
// chuỗi tự do Admin nhập, nên không có rủi ro leo thang quyền như whitelist đó phòng tránh). Đồng bộ
// thật qua EmployeeService.SyncAutoGrantedPermissionsCoreAsync, gộp CHUNG với permission tự động theo
// Chức vụ trong CÙNG 1 lần gọi IUserDirectoryService.SyncAutoGrantedPermissionsAsync — không được gọi
// tách rời, nếu không lần gọi sau sẽ xoá mất lần cấp trước (xem ghi chú tại
// EmployeeService.SyncAutoGrantedPermissionsCoreAsync).
public static class ApprovalStepCoordinatorPermissions
{
    // Cấp cho BẤT KỲ ai đang phụ trách ít nhất 1 Bộ phận hoặc 1 Nhóm — màn "Cây duyệt" là 1 màn DUY
    // NHẤT hợp nhất cả 2 khối Bộ phận + Nhóm (2026-08-10), nên dù chỉ phụ trách 1 phía vẫn cần đọc
    // được cả 2 khối để màn không lỗi khi tải; quyền GHI (Update) mới tách theo đúng vai trò được gán.
    public static readonly string[] BaseViewCodes =
    {
        "Attendance.Department.View",
        "Attendance.Group.View",
        "Attendance.JobTitle.View",
        "Attendance.Employee.View",
        "Attendance.DepartmentApprovalStep.View",
        "Attendance.GroupApprovalStep.View",
        // Khối "Theo chuyền" (ProductionApprovalStep) cũng scope theo DepartmentId như khối Bộ phận
        // — BỊ QUÊN khi thêm tab này (2026-08-24), khiến Người phụ trách Bộ phận không xem/sửa được
        // tab "Theo chuyền" trên màn Cây duyệt dù tab "Theo Nhóm" vẫn hoạt động bình thường. Sửa
        // 2026-09-04. View cấp cho cả 2 vai (giống DepartmentApprovalStep.View/GroupApprovalStep.View
        // ở trên) để màn không lỗi khi tải dù chỉ phụ trách 1 phía; quyền GHI vẫn tách riêng theo
        // isDeptCoordinator bên dưới (đúng scope Bộ phận của khối Chuyền).
        "Attendance.ProductionApprovalStep.View",
    };

    public const string DepartmentUpdateCode = "Attendance.DepartmentApprovalStep.Update";

    public const string GroupUpdateCode = "Attendance.GroupApprovalStep.Update";

    // Cùng scope Bộ phận với DepartmentUpdateCode — xem ghi chú BaseViewCodes ở trên (2026-09-04).
    public const string ProductionUpdateCode = "Attendance.ProductionApprovalStep.Update";

    // Người phụ trách Bộ phận được cấp thêm quyền sửa giới hạn OT cá nhân (2026-08-29) — tự scope theo
    // ĐÚNG Bộ phận qua IDepartmentAccessGuard, xem EmployeeService.UpdateOtLimitAsync. Nhân sự dưới
    // chuyền (ProductionEmployee.View/Update/Import/Export) và import Excel lũy kế
    // (EmployeeAccumulation.Import) KHÔNG còn tự cấp từ 2026-09-26 — phải được Admin chỉ định rõ (theo
    // Chức vụ qua JobTitlePermissionWhitelist, hoặc gán từng user).
    public const string EmployeeUpdateOtLimitCode = "Attendance.Employee.UpdateOtLimit";

    // Sửa tay lũy kế 1 nhân viên (2026-09-26) — cấp cho CẢ Người phụ trách Bộ phận lẫn Nhóm, scope theo
    // đúng Bộ phận/Nhóm họ phụ trách (xem EmployeeService.EnsureCanManageAccumulationAsync).
    public const string EmployeeAccumulationUpdateCode = "Attendance.EmployeeAccumulation.Update";
}
