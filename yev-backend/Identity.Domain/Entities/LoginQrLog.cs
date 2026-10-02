namespace Identity.Domain.Entities;

// Audit trail of QR login activity. No foreign keys on purpose: history must survive deleting the user
// or the code.
public class LoginQrLog
{
    public int Id { get; set; }

    // User the QR belongs to; null for a failed scan whose code matched nothing.
    public int? UserId { get; set; }

    public int? QrCodeId { get; set; }

    // Created / Revoked / LoginSuccess / LoginFailed.
    public string Action { get; set; } = null!;

    // Admin who generated/revoked the code; null for scan events.
    public int? ActorUserId { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; }
}
