namespace Workflow.Domain.Entities;

// Only for auto-filling at approval; the audit copy is the snapshot in WorkflowRequestHistories.SignatureImage.
// Updates always go through PendingEmployeeSignatureConfirmation + email confirmation.
public partial class EmployeeSignature
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public byte[] SignatureImage { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }

    public virtual Employee Employee { get; set; } = null!;
}
