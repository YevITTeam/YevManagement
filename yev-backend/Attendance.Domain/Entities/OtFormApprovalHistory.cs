using System;

namespace Attendance.Domain.Entities;

// Per-level approval history of an OtForm — each row is one Submit/Approve/Reject action, with a signature (if OtCase.RequireSignature).
public partial class OtFormApprovalHistory
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    public int OtFormApprovalStepId { get; set; }

    // Creator/approver — stores the UserName, for the same reason as OtForm.CreatedByUserName.
    public string ApproverUserName { get; set; } = null!;

    // Snapshot of the JWT FullName at signing so PDF printing needs no Identity call.
    public string? ApproverFullName { get; set; }

    // Set when the approver acted through a delegation: the candidate (delegator) they covered.
    public string? OnBehalfOfUserName { get; set; }

    public string? OnBehalfOfFullName { get; set; }

    // Stores the Attendance.Domain.Enums.ApprovalAction enum as an int.
    public int Action { get; set; }

    public string? Comment { get; set; }

    // Snapshot so a later signature change does not alter past approvals.
    public byte[]? SignatureImage { get; set; }

    // Closed by Admin from a scanned paper copy: the approver above is the reviewer, not the signer.
    public bool IsPaperApproval { get; set; }

    public DateTime ActionAt { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual OtFormApprovalStep OtFormApprovalStep { get; set; } = null!;
}
