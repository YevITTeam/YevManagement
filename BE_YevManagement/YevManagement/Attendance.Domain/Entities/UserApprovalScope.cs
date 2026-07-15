namespace Attendance.Domain.Entities;

// Ánh xạ 1 User (Identity, khác DB — lưu UserName) được phép duyệt OtForm thuộc phạm vi
// (ScopeType, ScopeId) nào, ở cấp duyệt (ApprovalLevel) nào. VD: UserName="nguyenvana" duyệt cấp
// DepartmentManager của Department có Id=5.
public partial class UserApprovalScope
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    // Lưu enum Attendance.Domain.Enums.ScopeType dưới dạng int.
    public int ScopeType { get; set; }

    // Id của Area/Line/Group/Department tương ứng với ScopeType — không có FK thật vì đa hình (polymorphic).
    public int ScopeId { get; set; }

    // Lưu enum Attendance.Domain.Enums.ApprovalLevel dưới dạng int.
    public int ApprovalLevel { get; set; }

    public bool IsDeleted { get; set; }
}
