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
    usbAlias: string | null;
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
    // False = the PC's agent went silent, so an open session's unplug time is unknown.
    agentOnline: boolean;
    fileEventCount: number;
}

// One USB on one PC, its sessions there rolled up.
export interface UsbMachineUsbDto {
    usbDeviceId: number;
    vendorId: string;
    productId: string;
    serialNumber: string;
    friendlyName: string | null;
    alias: string | null;
    capacityBytes: number | null;
    deviceClass: string;
    isApproved: boolean;
    accessLevel: number;
    isSharedSerial: boolean;
    // Approved for this PC only; false when the PC matches no asset device.
    approvedHere: boolean;
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
    // Admin-given name; shown instead of friendlyName when set.
    alias: string | null;
    capacityBytes: number | null;
    deviceClass: string;
    isApproved: boolean;
    approvedBy: string | null;
    approvedAt: string | null;
    approvalNote: string | null;
    // USB_ACCESS_LEVEL; applies wherever the USB is approved.
    accessLevel: number;
    // The bridge chip's serial is shared by every unit of the model, so an approval covers all of them.
    isSharedSerial: boolean;
    departmentId: number | null;
    departmentName: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    sessionCount: number;
    lastMachineName: string | null;
    // Per-machine approvals; empty when isApproved (every machine) or not approved.
    approvedMachines: { deviceId: number; deviceCode: string }[];
}

export interface UsbMachineOptionDto {
    id: number;
    deviceCode: string;
    deviceName: string;
}

// allMachines=false replaces the per-machine list with exactly deviceIds.
export interface UsbApprovalRequest {
    note: string | null;
    allMachines: boolean;
    deviceIds: number[];
    accessLevel: number;
    departmentId: number;
}

export interface UsbDepartmentOptionDto {
    id: number;
    name: string;
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
    // AGENT_EVENT_META key of the latest lifecycle event; null for agents before 1.3.
    lastEventType: number | null;
    lastEventAt: string | null;
}

export interface UsbAgentEventDto {
    eventType: number;
    occurredAt: string;
    actor: string | null;
    detail: string | null;
}

export interface UsbAgentSettingDto {
    trackCopyIn: boolean;
    hasUninstallPassword: boolean;
    // Version every agent (or only updateMachines when set) should run; null = no automatic update.
    targetVersion: string | null;
    updateMachines: string | null;
}

export interface UsbAgentSettingRequest {
    trackCopyIn: boolean;
    targetVersion: string | null;
    updateMachines: string | null;
}

export interface UsbAgentReleaseDto {
    id: number;
    version: string;
    sizeBytes: number;
    sha256: string;
    note: string | null;
    uploadedBy: string | null;
    uploadedAt: string;
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
