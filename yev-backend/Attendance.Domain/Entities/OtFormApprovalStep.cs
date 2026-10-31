using System.Collections.Generic;

namespace Attendance.Domain.Entities;

// Snapshotted once at form creation so later org/approval-tree changes do not affect in-flight forms.
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

    public int TerminalLevelSnapshot { get; set; }

    public int Status { get; set; }

    public bool IsDeleted { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual JobTitle JobTitle { get; set; } = null!;

    public virtual ICollection<OtFormApprovalStepCandidate> Candidates { get; set; } = new List<OtFormApprovalStepCandidate>();

    public virtual ICollection<OtFormApprovalHistory> ApprovalHistories { get; set; } = new List<OtFormApprovalHistory>();

    public virtual ICollection<OtFormApprovalEmailToken> ApprovalEmailTokens { get; set; } = new List<OtFormApprovalEmailToken>();
}
