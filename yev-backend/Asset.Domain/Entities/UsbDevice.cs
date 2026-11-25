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

    // Admin-given name ("Token ký số kế toán"); FriendlyName is the hardware model and repeats across sticks.
    public string? Alias { get; set; }

    public long? CapacityBytes { get; set; }

    public DateTime FirstSeenAt { get; set; }

    public DateTime LastSeenAt { get; set; }

    // PnP class: "DiskDrive" for storage; "WPD"/"Image" are phones and cameras, logged only and never approved or blocked.
    public string DeviceClass { get; set; } = UsbDeviceClasses.DiskDrive;

    // Approved on every machine; per-machine approvals live in Machines. Needs a real serial to tell sticks apart.
    public bool IsApproved { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public string? ApprovalNote { get; set; }

    // UsbAccessLevel granted wherever the USB is approved (every machine or the listed ones).
    public int AccessLevel { get; set; } = 2;

    // The bridge chip reports a serial every unit of the model shares and the inner disk's own serial could not be
    // read, so an approval covers every such enclosure.
    public bool IsSharedSerial { get; set; }

    public virtual ICollection<UsbDeviceMachine> Machines { get; set; } = new List<UsbDeviceMachine>();
}

public static class UsbDeviceClasses
{
    public const string DiskDrive = "DiskDrive";
}
