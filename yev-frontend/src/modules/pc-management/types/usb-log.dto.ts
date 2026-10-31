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
    fileEventCount: number;
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
