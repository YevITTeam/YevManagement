namespace Workflow.Domain.Entities;

// New signature awaiting the owner's email confirmation, so a hijacked session can't change it.
public partial class PendingEmployeeSignatureConfirmation
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public byte[] SignatureImage { get; set; } = null!;

    // The only credential: the confirmation endpoint is [AllowAnonymous].
    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = not confirmed yet.
    public DateTime? ConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Employee Employee { get; set; } = null!;
}
