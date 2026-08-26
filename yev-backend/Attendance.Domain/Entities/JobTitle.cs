using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Master data cho cây chức vụ dùng để tự suy luận chuỗi duyệt OT (thay thế UserApprovalScope thủ
// công) — xem plan "Cây Chức vụ" trong docs/docs-be/attendance-module.md.
public partial class JobTitle
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    // Cấp độ (CapDo) — số càng lớn càng cao. Dùng để loại các Chức vụ ngang/thấp hơn người tạo đơn ra
    // khỏi cây duyệt của Phòng ban (DepartmentApprovalStep) — KHÔNG dùng để tự bắc cầu qua mọi cấp
    // đang có người giữ nữa (2026-08-06, sửa theo phản hồi người dùng — bắc cầu tự động khiến 1 đơn
    // phải qua quá nhiều bước nếu Phòng ban có đủ người ở mọi cấp). Cây duyệt thật nằm ở
    // DepartmentApprovalStep, Admin tự chọn tay các Chức vụ nào là bước duyệt cho từng Phòng ban.
    public int RankOrder { get; set; }

    // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — None nếu chỉ là cấp trung gian.
    public int TerminalLevel { get; set; }

    // true CHỈ cho "Line Leader" (2026-08-24) — đánh dấu Chức vụ này tìm ứng viên theo phạm vi Line
    // (Employee.JobTitleId khớp + ProductionEmployee.ProductionLineId khớp Line của đơn), KHÁC với
    // Chức vụ trung gian thường (Group Leader/Team Leader — tìm theo Employee.GroupId). Tách riêng
    // khỏi TerminalLevel vì TerminalLevel mang nghĩa "cấp CUỐI chuỗi duyệt phải chạm tới" (dùng để cắt
    // relevantSteps trong JobTitleApprovalChainService) — Line Leader không phải cấp cuối, vẫn đúng
    // TerminalLevel=None, chỉ khác PHẠM VI tìm ứng viên. KHÔNG hardcode Code=="LL" ở nơi dùng (tránh
    // đúng lỗi đã gặp với "SM" trùng mã trước đây).
    public bool IsLineScoped { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();

    public virtual ICollection<DepartmentApprovalStep> DepartmentApprovalSteps { get; set; } = new List<DepartmentApprovalStep>();

    public virtual ICollection<GroupApprovalStep> GroupApprovalSteps { get; set; } = new List<GroupApprovalStep>();

    public virtual ICollection<JobTitlePermission> JobTitlePermissions { get; set; } = new List<JobTitlePermission>();

    public virtual ICollection<ProductionApprovalStep> ProductionApprovalSteps { get; set; } = new List<ProductionApprovalStep>();
}
