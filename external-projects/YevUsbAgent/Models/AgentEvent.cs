using System.Text.Json.Serialization;

namespace YevUsbAgent;

public static class EventTypes
{
    public const string Connected = "Connected";
    public const string Disconnected = "Disconnected";
    public const string File = "File";
    public const string Policy = "Policy";
}

// Values mirror Asset.Domain UsbFileAction.
public static class FileActions
{
    public const int Created = 1;
    public const int Modified = 2;
    public const int Deleted = 3;
    public const int Renamed = 4;
}

// Values mirror Asset.Domain UsbBlockMode / UsbPolicyResult.
public static class PolicyModes
{
    public const int Off = 0;
    public const int Audit = 1;
    public const int Enforce = 2;
}

public static class PolicyResults
{
    public const int Approved = 1;
    public const int Blocked = 2;
    public const int NotApproved = 3;
    public const int BlockFailed = 4;
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
    public string? DeviceClass { get; set; }
    public int? PolicyResult { get; set; }

    public Guid EventId { get; set; }
    public int Action { get; set; }
    public string? FilePath { get; set; }
    public string? OldFilePath { get; set; }
    public long? SizeBytes { get; set; }
}

public sealed record IngestRequest(string MachineName, List<AgentEvent> Events);

public sealed record SyncRequest(string MachineName, string? AgentVersion, string? WindowsUser, string? PolicyVersion);

// UsbLogController.AgentSync, inside the BE's ApiResponse envelope.
public sealed class SyncResponse
{
    public int Mode { get; set; }
    public string PolicyVersion { get; set; } = "";
    public List<string>? Approved { get; set; }
}

public sealed class SyncEnvelope
{
    public SyncResponse? Data { get; set; }
}

public sealed class PolicyFile
{
    public int Mode { get; set; }
    public string? Version { get; set; }
    public List<string> Approved { get; set; } = new();
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(AgentEvent))]
[JsonSerializable(typeof(IngestRequest))]
[JsonSerializable(typeof(SyncRequest))]
[JsonSerializable(typeof(SyncEnvelope))]
[JsonSerializable(typeof(PolicyFile))]
internal sealed partial class AgentJson : JsonSerializerContext
{
}
