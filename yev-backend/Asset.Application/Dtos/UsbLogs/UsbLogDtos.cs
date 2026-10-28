using Asset.Domain.Enums;

namespace Asset.Application.Dtos.UsbLogs
{
    public class UsbSessionFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public int? DeviceId { get; set; }
        public string? MachineName { get; set; }
        public string? Keyword { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public bool UnpermittedOnly { get; set; }
    }

    public class UsbMachineFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? Keyword { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public bool ConnectedNowOnly { get; set; }
    }

    // One PC that has USB activity. Grouped by MachineName so PCs that match no Device still appear.
    public class UsbMachineDto
    {
        public string MachineName { get; set; } = null!;
        public int? DeviceId { get; set; }
        public string? DeviceCode { get; set; }
        public string? LastWindowsUser { get; set; }
        public int SessionCount { get; set; }
        public int UsbDeviceCount { get; set; }
        public int FileEventCount { get; set; }
        public DateTime LastConnectedAt { get; set; }
        public bool IsConnectedNow { get; set; }
        public int UnpermittedCount { get; set; }
    }

    public class UsbSessionDto
    {
        public Guid Id { get; set; }
        public string MachineName { get; set; } = null!;
        public int? DeviceId { get; set; }
        public string? DeviceCode { get; set; }
        public string? WindowsUser { get; set; }
        public string VendorId { get; set; } = null!;
        public string ProductId { get; set; } = null!;
        public string SerialNumber { get; set; } = null!;
        public string? FriendlyName { get; set; }
        public long? CapacityBytes { get; set; }
        public string? DriveLetter { get; set; }
        public string? VolumeLabel { get; set; }
        public DateTime ConnectedAt { get; set; }
        public DateTime? DisconnectedAt { get; set; }
        public bool? WasPermitted { get; set; }
        public int FileEventCount { get; set; }
    }

    public class UsbFileEventDto
    {
        public long Id { get; set; }
        public int Action { get; set; }
        public string ActionText => Action.GetUsbFileActionText();
        public string FilePath { get; set; } = null!;
        public string? OldFilePath { get; set; }
        public long? SizeBytes { get; set; }
        public DateTime OccurredAt { get; set; }
    }
}
