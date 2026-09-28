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

    // Sửa giới hạn OT cá nhân (2026-08-29) — cấp cho CẢ Người phụ trách Bộ phận lẫn Nhóm (mở rộng cho
    // Nhóm ngày 2026-09-28), scope theo đúng Bộ phận/Nhóm họ phụ trách, xem
    // EmployeeService.EnsureCanManageDeptOrGroupScopeAsync.
    public const string EmployeeUpdateOtLimitCode = "Attendance.Employee.UpdateOtLimit";

    // Sửa tay lũy kế 1 nhân viên (2026-09-26) — cấp cho CẢ Người phụ trách Bộ phận lẫn Nhóm, scope theo
    // đúng Bộ phận/Nhóm họ phụ trách, xem EmployeeService.EnsureCanManageDeptOrGroupScopeAsync.
    public const string EmployeeAccumulationUpdateCode = "Attendance.EmployeeAccumulation.Update";

    // Import Excel lũy kế hàng loạt (2026-09-28, theo yêu cầu người dùng — trước đó KHÔNG tự cấp, phải
    // Admin chỉ định tay) — cùng scope Bộ phận/Nhóm với EmployeeAccumulationUpdateCode ở trên, vì đây
    // chỉ là "sửa hàng loạt" đúng field đã cho sửa từng người; scope THEO TỪNG DÒNG file Excel, xem
    // EmployeeImportService.ImportOtHourLimitsAsync/ImportMonthlyAccumulationAsync.
    public const string EmployeeAccumulationImportCode = "Attendance.EmployeeAccumulation.Import";

    // Coordinator = "y hệt Admin nhưng trong đúng phạm vi" (2026-09-28, theo yêu cầu người dùng) — 3
    // quyền hồ sơ nhân viên đầy đủ (Code/Tên/Group/Chức vụ, không chỉ 2 field OT-limit/lũy kế hẹp ở
    // trên), TRƯỚC ĐÓ cố tình 100% Admin-only vì "sửa Code/Tên/Group của MỌI nhân viên, quá rộng" —
    // giờ đổi hướng: vẫn rộng như Admin, nhưng khoá cứng theo Bộ phận/Nhóm phụ trách (xem
    // EmployeeService.EnsureCanManageDeptOrGroupScopeAsync/EnsureAssignmentInCallerScopeAsync). Cấp cho
    // CẢ Bộ phận lẫn Nhóm, đối xứng với EmployeeUpdateOtLimitCode/EmployeeAccumulationUpdateCode.
    public const string EmployeeCreateCode = "Attendance.Employee.Create";
    public const string EmployeeUpdateCode = "Attendance.Employee.Update";
    public const string EmployeeDeleteCode = "Attendance.Employee.Delete";

    // Nhân sự dưới chuyền (2026-09-28, theo yêu cầu người dùng) — CHỈ cấp cho Người phụ trách BỘ PHẬN,
    // KHÔNG cấp cho Người phụ trách Nhóm (dữ liệu "dưới chuyền" là khái niệm cấp Phòng ban — gắn với
    // Line/Team/Nhóm ca của cả 1 Phòng ban sản xuất, không tách theo từng Nhóm con). Scope THEO Phòng
    // ban ở mọi endpoint dùng các mã này (View/Update/Export theo `IDepartmentAccessGuard`; Import qua
    // ProductionEmployeeImportService đã hardcode cứng 1 Phòng ban "CT" từ trước).
    public const string ProductionEmployeeViewCode = "Attendance.ProductionEmployee.View";
    public const string ProductionEmployeeUpdateCode = "Attendance.ProductionEmployee.Update";
    public const string ProductionEmployeeImportCode = "Attendance.ProductionEmployee.Import";
    public const string ProductionEmployeeExportCode = "Attendance.ProductionEmployee.Export";
}
