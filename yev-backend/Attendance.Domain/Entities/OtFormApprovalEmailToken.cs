using System;

namespace Attendance.Domain.Entities;

// Email approval link for one approver; only resolves the approver and then calls ApproveAsync/RejectAsync, so no approval logic is duplicated.
public partial class OtFormApprovalEmailToken
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    // Snapshot at send time; each candidate of a step gets its own token.
    public string ApproverUserName { get; set; } = null!;

    public string? ApproverFullName { get; set; }

    // ApproveAsync/RejectAsync re-check the current step, so tokens of a passed step are effectively void.
    public int OtFormApprovalStepId { get; set; }

    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = not used yet. A value = the timestamp when Approve or Reject was clicked via this link.
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual OtFormApprovalStep OtFormApprovalStep { get; set; } = null!;
}
