using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class Employee
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    // Tài khoản AD của chính nhân viên này (nullable — không phải nhân viên nào cũng có tài khoản
    // đăng nhập). Dùng để cho phép nhân viên tự chỉnh lũy kế của chính mình (so khớp CurrentUserName).
    public string? UserName { get; set; }

    // Nhóm cố định của nhân viên — dùng để Trưởng nhóm liệt kê/chọn hàng loạt nhân viên của mình khi
    // lập đơn OT. Department suy ra qua Group.DepartmentId, không cần lưu trùng trên Employee.
    // Nullable (2026-08-08) — chỉ nhân viên "thường" (JobTitle.TerminalLevel = None, hoặc chưa gán
    // Chức vụ) mới bắt buộc có Group thật; validate ở EmployeeService.ValidateOrganizationAssignment,
    // KHÔNG dùng ràng buộc NOT NULL ở DB vì tuỳ theo Chức vụ mà bắt buộc field khác nhau (xem DepartmentId).
    public int? GroupId { get; set; }

    // Phòng ban trực tiếp — CHỈ dùng cho Chức vụ TerminalLevel=DepartmentManager (Trưởng phòng): họ
    // không thuộc 1 Bộ phận cụ thể nào, chỉ cần biết quản lý Phòng ban nào (2026-08-08). Chức vụ
    // TerminalLevel=WorkshopManager/GeneralDirector (Trưởng Xưởng/Giám đốc) để cả GroupId lẫn
    // DepartmentId đều null — họ dùng chung toàn công ty (xem JobTitleApprovalChainService).
    public int? DepartmentId { get; set; }

    // Chức vụ hiện tại (cây Chức vụ dùng suy luận chuỗi duyệt OT) — nullable vì nhân viên cũ có thể
    // chưa được gán, và 1 người chỉ giữ đúng 1 Chức vụ tại 1 thời điểm (không kiêm nhiệm).
    public int? JobTitleId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group? Group { get; set; }

    public virtual Department? Department { get; set; }

    public virtual JobTitle? JobTitle { get; set; }

    public virtual ICollection<OtFormEmployee> OtFormEmployees { get; set; } = new List<OtFormEmployee>();

    public virtual ICollection<EmployeeAccumulationHistory> EmployeeAccumulationHistories { get; set; } = new List<EmployeeAccumulationHistory>();

    public virtual ICollection<ProductionEmployee> ProductionEmployees { get; set; } = new List<ProductionEmployee>();
}
