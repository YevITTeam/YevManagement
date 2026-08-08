namespace Attendance.Domain.Entities;

// 1 dòng / người đang giữ đúng JobTitle của bước này trong đúng Department (hoặc toàn công ty nếu
// TerminalLevelSnapshot=GeneralDirector), snapshot lúc tạo đơn — TẤT CẢ đều là candidate hợp lệ cho
// bước đó, ai thao tác (Approve/Reject) trước thì tính (2026-08-07, xem
// docs/attendance-module.md §Cây chức vụ).
public partial class OtFormApprovalStepCandidate
{
    public int Id { get; set; }

    public int OtFormApprovalStepId { get; set; }

    public int EmployeeId { get; set; }

    public string UserName { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public virtual OtFormApprovalStep OtFormApprovalStep { get; set; } = null!;
}
