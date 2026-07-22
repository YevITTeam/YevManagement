using System;

namespace Attendance.Domain.Entities;

// A new signature waiting for the owner to confirm via email before it takes effect (UserSignature is
// only upserted AFTER confirmation) — guards against someone hijacking a login session and changing
// another person's signature.
public partial class PendingSignatureConfirmation
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public byte[] SignatureImage { get; set; } = null!;

    // Random token used in the email link — it is itself the sole piece of verification (the
    // confirmation endpoint is [AllowAnonymous]), see Shared.Application.Helper.TokenHelper.
    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = not confirmed yet. A value = the timestamp when it was applied to UserSignature.
    public DateTime? ConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
