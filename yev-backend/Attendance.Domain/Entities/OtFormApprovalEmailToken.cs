using System;

namespace Attendance.Domain.Entities;

// Token sent with an email link to a specific approver (Department Manager/Workshop Manager/General
// Director) — an ADDITIONAL channel alongside the existing Approve/Reject buttons in the app, since
// managers rarely open the app. On confirmation, this token is only used to resolve
// ApproverUserName/ApprovalLevel and then directly calls the existing
// OtFormService.ApproveAsync/RejectAsync — no approval logic is duplicated.
public partial class OtFormApprovalEmailToken
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    // The specific approver this email was sent to — a snapshot at the time the mail was sent, does
    // not change with the current step candidates (a step can have multiple candidates, each with
    // their own token).
    public string ApproverUserName { get; set; } = null!;

    public string? ApproverFullName { get; set; }

    // Bước duyệt (đã snapshot) mà email này được gửi cho — thay cho ApprovalLevel:int cũ (2026-08-07,
    // Giai đoạn 3.1). ApproveAsync/RejectAsync vẫn tự re-check bước hiện tại của đơn, nên token của 1
    // bước đã bị vượt qua tự động vô hiệu.
    public int OtFormApprovalStepId { get; set; }

    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = not used yet. A value = the timestamp when Approve or Reject was clicked via this link.
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual OtFormApprovalStep OtFormApprovalStep { get; set; } = null!;
}
