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

    public bool IsDeleted { get; set; }

    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();

    public virtual ICollection<DepartmentApprovalStep> DepartmentApprovalSteps { get; set; } = new List<DepartmentApprovalStep>();

    public virtual ICollection<GroupApprovalStep> GroupApprovalSteps { get; set; } = new List<GroupApprovalStep>();

    public virtual ICollection<JobTitlePermission> JobTitlePermissions { get; set; } = new List<JobTitlePermission>();
}
