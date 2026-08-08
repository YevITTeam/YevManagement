using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// 1 bước duyệt đã SNAPSHOT của 1 OtForm cụ thể, chốt 1 LẦN DUY NHẤT ngay lúc tạo đơn (đọc từ
// DepartmentApprovalStep của đúng Department lúc đó — xem JobTitleApprovalChainService) — đơn đang
// chạy dở không bị xáo trộn nếu tổ chức/cây duyệt đổi giữa chừng (2026-08-07, Giai đoạn 3.1, xem
// docs/attendance-module.md §Cây chức vụ). Mọi bước được tạo Status=Pending ngay từ đầu; bước "đang
// chờ xử lý" thật sự là bước Pending có StepOrder NHỎ NHẤT của đơn đó.
public partial class OtFormApprovalStep
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public int StepOrder { get; set; }

    public int JobTitleId { get; set; }

    public string JobTitleCodeSnapshot { get; set; } = null!;

    public string JobTitleNameSnapshot { get; set; } = null!;

    public bool RequiresSignatureSnapshot { get; set; }

    public bool IsResponsibleSnapshot { get; set; }

    // Enum Attendance.Domain.Enums.JobTitleTerminalLevel.
    public int TerminalLevelSnapshot { get; set; }

    // Enum Attendance.Domain.Enums.OtFormApprovalStepStatus.
    public int Status { get; set; }

    public bool IsDeleted { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;

    public virtual ICollection<OtFormApprovalStepCandidate> Candidates { get; set; } = new List<OtFormApprovalStepCandidate>();

    public virtual ICollection<OtFormApprovalHistory> ApprovalHistories { get; set; } = new List<OtFormApprovalHistory>();

    public virtual ICollection<OtFormApprovalEmailToken> ApprovalEmailTokens { get; set; } = new List<OtFormApprovalEmailToken>();
}
