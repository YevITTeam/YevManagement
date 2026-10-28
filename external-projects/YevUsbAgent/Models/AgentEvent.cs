using System.Text.Json.Serialization;

namespace YevUsbAgent;

public static class EventTypes
{
    public const string Connected = "Connected";
    public const string Disconnected = "Disconnected";
    public const string File = "File";
}

// Values mirror Asset.Domain UsbFileAction.
public static class FileActions
{
    public const int Created = 1;
    public const int Modified = 2;
    public const int Deleted = 3;
    public const int Renamed = 4;
}

// Wire format of UsbLogController.Ingest; only the fields of the event's Type are filled.
public sealed class AgentEvent
{
    public string Type { get; set; } = "";
    public Guid SessionId { get; set; }
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.Now;

    public string? VendorId { get; set; }
    public string? ProductId { get; set; }
    public string? SerialNumber { get; set; }
    public string? FriendlyName { get; set; }
    public long? CapacityBytes { get; set; }
    public string? WindowsUser { get; set; }
    public string? DriveLetter { get; set; }
    public string? VolumeLabel { get; set; }

    public Guid EventId { get; set; }
    public int Action { get; set; }
    public string? FilePath { get; set; }
    public string? OldFilePath { get; set; }
    public long? SizeBytes { get; set; }
}

public sealed record IngestRequest(string MachineName, List<AgentEvent> Events);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(AgentEvent))]
[JsonSerializable(typeof(IngestRequest))]
internal sealed partial class AgentJson : JsonSerializerContext
{
}
