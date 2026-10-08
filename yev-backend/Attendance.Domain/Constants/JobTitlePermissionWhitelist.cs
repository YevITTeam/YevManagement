namespace Attendance.Domain.Constants;

// Danh sách CỐ ĐỊNH các permission được PHÉP cấu hình tự động cấp theo Chức vụ (2026-08-10) — chỉ
// gồm nhóm "tham gia quy trình" (duyệt/ký/xem danh mục để load dropdown). KHÔNG BAO GIỜ được thêm
// permission nhóm "quản trị" (CRUD danh mục Department/Group/OtCase/Reason/Employee/JobTitle,
// Setting.Update, AiChat.Use, *ApprovalStep.Update, JobTitlePermission.*, OTForm.Delete) vào đây —
// nếu không sẽ tái tạo đúng rủi ro đã loại bỏ khi xoá UserApprovalScope: 1 người có thể tự leo thang
// quyền quản trị chỉ bằng cách đổi Chức vụ cho chính mình. Validate ở
// JobTitlePermissionService.ReplaceAsync — xem docs/docs-be/attendance-module.md §Cây chức vụ, mục
// "Quyền theo Chức vụ".
public static class JobTitlePermissionWhitelist
{
    public static readonly IReadOnlySet<string> AllowedCodes = new HashSet<string>
    {
        "Attendance.OTForm.View",
        "Attendance.OTForm.Create",
        "Attendance.OTForm.Approve",
        "Attendance.OTForm.RemoveEmployee",
        "Attendance.OTForm.AddEmployee",
        "Attendance.OTForm.Delegate",
        // Tạo đơn tăng ca THEO CHUYỀN (2026-09-26) — trước chỉ Line Leader làm được (kiểm cứng ở
        // OtFormService), nay là quyền cấu hình được theo Chức vụ hoặc từng user.
        "Attendance.OTForm.CreateProduction",
        "Attendance.UserSignature.View",
        "Attendance.UserSignature.Update",
        "Attendance.SecondaryPassword.Update",
        "Attendance.Department.View",
        "Attendance.Group.View",
        "Attendance.OtCase.View",
        "Attendance.Reason.View",
        "Attendance.Employee.View",
        "Attendance.JobTitle.View",
        "Attendance.ProductionOtReport.View",
        // Nhân sự dưới chuyền + các chức năng Excel (2026-09-26): KHÔNG còn tự cấp cho Người phụ trách
        // Cây duyệt — Admin chỉ định rõ Chức vụ nào được vào/nhập/xuất ở đây (hoặc gán cho từng user).
        "Attendance.ProductionEmployee.View",
        "Attendance.ProductionEmployee.Update",
        "Attendance.ProductionEmployee.Import",
        "Attendance.ProductionEmployee.Export",
        "Attendance.EmployeeAccumulation.Import",
    };
}
