using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtCase
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    // Determines whether the approval flow of an OtForm using this OtCase requires a handwritten signature (SignatureImage).
    public bool RequireSignature { get; set; }

    // The FINAL level an OtForm using this OtCase must reach (enum Attendance.Domain.Enums.JobTitleTerminalLevel,
    // stored as int; 2026-08-07 Giai đoạn 3.1 — thay ApprovalLevel cũ, value int 1/2/3 trùng nhau nên không
    // cần đổi kiểu cột). The chain now walks the dynamic JobTitle rank chain (see JobTitleApprovalChainService),
    // stopping once a step reaches this TerminalLevel.
    public int RequiredApprovalLevel { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
