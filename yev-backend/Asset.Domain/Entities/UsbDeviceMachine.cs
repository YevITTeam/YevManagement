namespace Asset.Domain.Entities;

// Per-machine write approval for a USB that is not approved everywhere (UsbDevice.IsApproved = all machines).
// Keyed by the asset Device; the agent's computer name is matched to it the same way USB logs are.
public class UsbDeviceMachine
{
    public int Id { get; set; }

    public int UsbDeviceId { get; set; }

    public int DeviceId { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTime ApprovedAt { get; set; }

    public virtual UsbDevice UsbDevice { get; set; } = null!;

    public virtual Device Device { get; set; } = null!;
}
