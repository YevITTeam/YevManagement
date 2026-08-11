namespace Attendance.Domain.Entities;

// Người được Admin CHỈ ĐỊNH TAY phụ trách cấu hình Cây duyệt của 1 Nhóm (2026-08-11, sửa 2026-08-11b:
// khoá theo EmployeeId thay vì UserName) — mirror DepartmentApprovalStepCoordinator nhưng khoá theo
// GroupId, chỉ được chọn trong số Employee đang thuộc ĐÚNG Nhóm này. Xem
// docs/docs-be/attendance-module.md §Cây chức vụ, mục "Người phụ trách Cây duyệt".
public partial class GroupApprovalStepCoordinator
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int EmployeeId { get; set; }

    public bool IsDeleted { get; set; }

    public virtual Group Group { get; set; } = null!;

    public virtual Employee Employee { get; set; } = null!;
}
