using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.UsbLogs
{
    public static class UsbEventTypes
    {
        public const string Connected = "Connected";
        public const string Disconnected = "Disconnected";
        public const string File = "File";
        // Re-evaluation of an open session after the policy changed (approved, revoked, mode switched).
        public const string Policy = "Policy";
        // Agent lifecycle: Action = UsbAgentEventType, WindowsUser = actor, Detail = free text.
        public const string Agent = "Agent";
    }

    // Batch sent by the PC agent. Only the fields of the event's Type are read.
    public class UsbIngestRequest
    {
        [Required(ErrorMessage = "Tên máy là bắt buộc.")]
        [StringLength(100, ErrorMessage = "Tên máy tối đa 100 ký tự.")]
        public string MachineName { get; set; } = null!;

        [Required(ErrorMessage = "Danh sách sự kiện là bắt buộc.")]
        public List<UsbIngestEvent> Events { get; set; } = new();
    }

    public class UsbIngestEvent
    {
        public string Type { get; set; } = null!;
        public Guid SessionId { get; set; }
        public DateTimeOffset OccurredAt { get; set; }

        // Connected
        public string? VendorId { get; set; }
        public string? ProductId { get; set; }
        public string? SerialNumber { get; set; }
        public string? FriendlyName { get; set; }
        public long? CapacityBytes { get; set; }
        public string? WindowsUser { get; set; }
        public string? DriveLetter { get; set; }
        public string? VolumeLabel { get; set; }
        public string? DeviceClass { get; set; }

        // True = shared bridge serial (UsbDevice.IsSharedSerial); null from agents before 1.3.
        public bool? SharedSerial { get; set; }

        // Connected + Policy
        public int? PolicyResult { get; set; }

        // File
        public Guid EventId { get; set; }
        public int Action { get; set; }
        public string? FilePath { get; set; }
        public string? OldFilePath { get; set; }
        public long? SizeBytes { get; set; }

        // Agent
        public string? Detail { get; set; }
    }

    public class UsbIngestResultDto
    {
        public int ProcessedCount { get; set; }
        public int SkippedCount { get; set; }
        public bool DeviceMatched { get; set; }
    }
}
