using System;

namespace Attendance.Domain.Entities;

// A new secondary password waiting for the owner to confirm via email before it takes effect
// (SecondaryPassword is only upserted AFTER confirmation) — same guard as PendingSignatureConfirmation:
// prevents someone hijacking a login session and setting another person's secondary password.
public partial class PendingSecondaryPasswordConfirmation
{
    public int Id { get; set; }

    public string UserName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    // Random token used in the email link — it is itself the sole piece of verification (the
    // confirmation endpoint is [AllowAnonymous]), see Shared.Application.Helper.TokenHelper.
    public string Token { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    // Null = not confirmed yet. A value = the timestamp when it was applied to SecondaryPassword.
    public DateTime? ConfirmedAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
