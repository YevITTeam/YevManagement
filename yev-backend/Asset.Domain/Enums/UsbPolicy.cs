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
    BlockFailed = 4,
    // Approved with UsbAccessLevel.ReadOnly: readable, write-blocked.
    ReadOnly = 5
}

public enum UsbAccessLevel
{
    ReadOnly = 1,
    ReadWrite = 2
}

// Values are shared with YevUsbAgent.
public enum UsbAgentEventType
{
    Installed = 1,
    Started = 2,
    Stopped = 3,
    AbnormalStop = 4,
    Uninstalled = 5,
    UninstallDenied = 6,
    UpdateFailed = 7
}
