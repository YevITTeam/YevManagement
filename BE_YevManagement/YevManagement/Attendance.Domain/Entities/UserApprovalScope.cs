namespace Attendance.Domain.Entities;

// Ánh xạ 1 User (Identity, khác DB) được phép duyệt OtForm thuộc phạm vi (ScopeType, ScopeId) nào,
// ở cấp duyệt (ApprovalLevel) nào. VD: UserId=123 duyệt cấp LineManager của Line có Id=5.
public partial class UserApprovalScope
{
    public int Id { get; set; }

    public int UserId { get; set; }

    // Lưu enum Attendance.Domain.Enums.ScopeType dưới dạng int.
    public int ScopeType { get; set; }

    // Id của Area/Line/Group/Department tương ứng với ScopeType — không có FK thật vì đa hình (polymorphic).
    public int ScopeId { get; set; }

    // Lưu enum Attendance.Domain.Enums.ApprovalLevel dưới dạng int.
    public int ApprovalLevel { get; set; }

    public bool IsDeleted { get; set; }
}
