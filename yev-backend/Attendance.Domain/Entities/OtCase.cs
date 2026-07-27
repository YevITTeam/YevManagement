using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtCase
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    // Determines whether the approval flow of an OtForm using this OtCase requires a handwritten signature (SignatureImage).
    public bool RequireSignature { get; set; }

    // The FINAL approval level an OtForm using this OtCase must reach (enum Attendance.Domain.Enums.ApprovalLevel,
    // stored as int). The form still goes sequentially Submitter -> DepartmentManager -> WorkshopManager -> GeneralDirector,
    // stopping once it reaches this level (e.g.: Case1=DepartmentManager, Case2=WorkshopManager, Case3=GeneralDirector).
    public int RequiredApprovalLevel { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
