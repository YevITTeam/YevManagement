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
    };

    public const string DepartmentUpdateCode = "Attendance.DepartmentApprovalStep.Update";

    public const string GroupUpdateCode = "Attendance.GroupApprovalStep.Update";

    // Cấp thêm cho Người phụ trách Bộ phận (2026-08-29, theo yêu cầu người dùng — "mọi quyền đó mình
    // sẽ giao cho người phụ trách của cái phòng ban đó"): nhân sự dưới chuyền + lũy kế + giới hạn OT,
    // TẤT CẢ đều tự scope theo ĐÚNG Bộ phận qua IDepartmentAccessGuard (không phải toàn công ty) — xem
    // ProductionEmployeeImportService/EmployeeService.UpdateOtLimitAsync. Chỉ gắn với isDeptCoordinator
    // (không phải isGroupCoordinator — 3 việc này là cấp Bộ phận, không phải cấp Nhóm).
    public const string ProductionEmployeeImportCode = "Attendance.ProductionEmployee.Import";

    public const string EmployeeAccumulationImportCode = "Attendance.EmployeeAccumulation.Import";

    public const string EmployeeUpdateOtLimitCode = "Attendance.Employee.UpdateOtLimit";
}
