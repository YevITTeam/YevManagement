// Read-only USB log sent by the PC agent, grouped by machine name; deviceId null = name matches no device.
export interface UsbMachineDto {
    machineName: string;
    deviceId: number | null;
    deviceCode: string | null;
    lastWindowsUser: string | null;
    sessionCount: number;
    usbDeviceCount: number;
    fileEventCount: number;
    lastConnectedAt: string;
    isConnectedNow: boolean;
    unpermittedCount: number;
    blockedCount: number;
}

export interface UsbSessionDto {
    id: string;
    machineName: string;
    deviceId: number | null;
    deviceCode: string | null;
    windowsUser: string | null;
    vendorId: string;
    productId: string;
    serialNumber: string;
    friendlyName: string | null;
    capacityBytes: number | null;
    driveLetter: string | null;
    volumeLabel: string | null;
    connectedAt: string;
    disconnectedAt: string | null;
    // false = not permitted at plug-in time (BE then enabled IsUseUsb); null = machine name matches no device.
    wasPermitted: boolean | null;
    // UsbPolicyResult; null when the block mode was Off or the device is not a disk.
    policyResult: number | null;
    usbDeviceId: number;
    deviceClass: string;
    isApproved: boolean;
    fileEventCount: number;
}

// One USB on one PC, its sessions there rolled up.
export interface UsbMachineUsbDto {
    usbDeviceId: number;
    vendorId: string;
    productId: string;
    serialNumber: string;
    friendlyName: string | null;
    capacityBytes: number | null;
    deviceClass: string;
    isApproved: boolean;
    driveLetters: string[];
    sessionCount: number;
    fileEventCount: number;
    lastConnectedAt: string;
    isConnectedNow: boolean;
    lastPolicyResult: number | null;
}

export interface UsbDeviceDto {
    id: number;
    vendorId: string;
    productId: string;
    serialNumber: string;
    friendlyName: string | null;
    capacityBytes: number | null;
    deviceClass: string;
    isApproved: boolean;
    approvedBy: string | null;
    approvedAt: string | null;
    approvalNote: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    sessionCount: number;
    lastMachineName: string | null;
}

// mode: 0 Off, 1 Audit, 2 Enforce (only for enforceMachines when that list is not empty).
export interface UsbPolicySettingDto {
    mode: number;
    enforceMachines: string | null;
}

export interface UsbAgentDto {
    id: number;
    machineName: string;
    agentVersion: string | null;
    windowsUser: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    isStale: boolean;
}

export interface UsbFileEventDto {
    id: number;
    action: number;
    actionText: string;
    filePath: string;
    oldFilePath: string | null;
    sizeBytes: number | null;
    occurredAt: string;
}
