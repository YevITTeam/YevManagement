namespace Asset.Domain.Entities;

// An agent build uploaded for automatic update. Signature is RSA-SHA256 over the exe with the release key,
// so a stolen web login alone cannot push code to every PC.
public class UsbAgentRelease
{
    public int Id { get; set; }

    public string Version { get; set; } = null!;

    // Name inside the AppRelease storage folder.
    public string StoredFileName { get; set; } = null!;

    public long SizeBytes { get; set; }

    public string Sha256 { get; set; } = null!;

    public string Signature { get; set; } = null!;

    public string? Note { get; set; }

    public string? UploadedBy { get; set; }

    public DateTime UploadedAt { get; set; }
}
