using System.Collections.Generic;

namespace Attendance.Domain.Entities;

public partial class OtCase
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    public string? DescriptionJp { get; set; }

    // Determines whether the approval flow of an OtForm using this OtCase requires a handwritten signature (SignatureImage).
    public bool RequireSignature { get; set; }

    // Terminal level the chain must reach (JobTitleTerminalLevel stored as int).
    public int RequiredApprovalLevel { get; set; }

    public bool IsDeleted { get; set; }

    public virtual ICollection<OtForm> OtForms { get; set; } = new List<OtForm>();
}
