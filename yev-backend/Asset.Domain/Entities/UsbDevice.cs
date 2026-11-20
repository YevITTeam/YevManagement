namespace Asset.Domain.Entities;

// One physical USB storage device, identified by (VendorId, ProductId, SerialNumber). SerialNumber is ""
// (not null) for devices that expose none so the unique index still works.
public partial class UsbDevice
{
    public int Id { get; set; }

    public string VendorId { get; set; } = null!;

    public string ProductId { get; set; } = null!;

    public string SerialNumber { get; set; } = "";

    public string? FriendlyName { get; set; }

    public long? CapacityBytes { get; set; }

    public DateTime FirstSeenAt { get; set; }

    public DateTime LastSeenAt { get; set; }

    // PnP class: "DiskDrive" for storage; "WPD"/"Image" are phones and cameras, logged only and never approved or blocked.
    public string DeviceClass { get; set; } = UsbDeviceClasses.DiskDrive;

    // The write-block whitelist: agents leave approved disks writable everywhere. Needs a real serial to tell sticks apart.
    public bool IsApproved { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string? ApprovalNote { get; set; }
}

public static class UsbDeviceClasses
{
    public const string DiskDrive = "DiskDrive";
}
