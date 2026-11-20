namespace Asset.Domain.Enums;

public enum UsbBlockMode
{
    Off = 0,
    Audit = 1,
    Enforce = 2
}

// Values are shared with YevUsbAgent.
public enum UsbPolicyResult
{
    Approved = 1,
    Blocked = 2,
    NotApproved = 3,
    BlockFailed = 4
}
