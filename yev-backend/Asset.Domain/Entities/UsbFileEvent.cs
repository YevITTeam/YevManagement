namespace Asset.Domain.Entities;

// One file operation on a USB drive during a session. EventId is agent-generated and unique (dedupe on resend).
public partial class UsbFileEvent
{
    public long Id { get; set; }

    public Guid EventId { get; set; }

    public Guid SessionId { get; set; }

    public int Action { get; set; }

    public string FilePath { get; set; } = null!;

    public string? OldFilePath { get; set; }

    public long? SizeBytes { get; set; }

    public DateTime OccurredAt { get; set; }

    public virtual UsbSession Session { get; set; } = null!;
}
