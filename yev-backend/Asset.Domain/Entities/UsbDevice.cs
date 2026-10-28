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
}
