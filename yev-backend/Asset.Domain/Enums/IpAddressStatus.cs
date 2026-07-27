namespace Asset.Domain.Enums;

// Assignment status of an IpAddress (2026-07-11, changed back — removed the old Reserved/Disabled,
// merged into 3 states per user decision). Invariant maintained: Status == Assigned(2) <=>
// DeviceId != null; Status == Available(0)/AssignedExternal(1) <=> DeviceId == null.
public enum IpAddressStatus
{
    // Not assigned — IP is still free, can be selected to assign to a device.
    Available = 0,

    // Assigned but has NO DeviceId in the system — the IP is being used by an "external"
    // device (not managed in the app); when displayed, DeviceCode returns "Other".
    AssignedExternal = 1,

    // Assigned and HAS a DeviceId — the IP is attached to a device managed in the system.
    Assigned = 2
}
