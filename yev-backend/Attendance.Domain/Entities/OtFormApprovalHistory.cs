using System;

namespace Attendance.Domain.Entities;

// Per-level approval history of an OtForm — each row is one Submit/Approve/Reject action, with a signature (if OtCase.RequireSignature).
public partial class OtFormApprovalHistory
{
    public int Id { get; set; }

    public int OtFormId { get; set; }

    // Bước duyệt (đã snapshot) mà hành động này thuộc về — thay cho ApprovalLevel:int cũ (2026-08-07,
    // Giai đoạn 3.1). Mọi thông tin "cấp nào" (tên Chức vụ, có bắt ký không...) đọc qua OtFormApprovalStep.
    public int OtFormApprovalStepId { get; set; }

    // Creator/approver — stores the UserName, for the same reason as OtForm.CreatedByUserName.
    public string ApproverUserName { get; set; } = null!;

    // Snapshot of the JWT "FullName" claim at signing time — so PDF printing doesn't need the FE to
    // call across to the Identity API. Null if the account has never had FullName entered by an
    // Admin at create-user time.
    public string? ApproverFullName { get; set; }

    // Stores the Attendance.Domain.Enums.ApprovalAction enum as an int.
    public int Action { get; set; }

    public string? Comment { get; set; }

    // Snapshot of the signature image at signing time — does not reference UserSignature back, to
    // avoid the old signature changing retroactively when the user updates their signature (see docs/attendance-module.md).
    public byte[]? SignatureImage { get; set; }

    public DateTime ActionAt { get; set; }

    public virtual OtForm OtForm { get; set; } = null!;

    public virtual OtFormApprovalStep OtFormApprovalStep { get; set; } = null!;
}
