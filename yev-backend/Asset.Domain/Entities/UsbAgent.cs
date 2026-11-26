namespace Asset.Domain.Entities;

// One PC running YevUsbAgent, upserted by its periodic sync so stopped or outdated agents show up.
public partial class UsbAgent
{
    public int Id { get; set; }

    public string MachineName { get; set; } = null!;

    public string? AgentVersion { get; set; }

    public string? WindowsUser { get; set; }

    public DateTime FirstSeenAt { get; set; }

    public DateTime LastSeenAt { get; set; }

    // Matched the way ingest matches a PC; null when the computer name is in no Device.
    public int? DeviceId { get; set; }

    public virtual Device? Device { get; set; }
}
