namespace Asset.Domain.Entities;

// Agent lifecycle (UsbAgentEventType) reported by the agent itself or its installer; EventId dedupes resends.
public class UsbAgentEvent
{
    public long Id { get; set; }

    public Guid EventId { get; set; }

    public string MachineName { get; set; } = null!;

    public int EventType { get; set; }

    public DateTime OccurredAt { get; set; }

    // Windows account that installed/uninstalled, or the console user for service events.
    public string? Actor { get; set; }

    public string? Detail { get; set; }
}
