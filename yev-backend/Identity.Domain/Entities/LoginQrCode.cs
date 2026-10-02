namespace Identity.Domain.Entities;

// Long-lived login credential printed as a QR code for the YEV Scan mobile app. Only the SHA-256 hash of
// the random code is stored, so the raw code cannot be recovered after it was shown once. A user has at
// most one active code (RevokedAt == null); generating a new one revokes the previous one.
public class LoginQrCode
{
    public int Id { get; set; }

    public int UserId { get; set; }

    // Hex SHA-256 of the raw code.
    public string CodeHash { get; set; } = null!;

    public int? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public int? RevokedByUserId { get; set; }

    public DateTime? LastUsedAt { get; set; }

    public int UseCount { get; set; }

    public virtual User User { get; set; } = null!;
}
