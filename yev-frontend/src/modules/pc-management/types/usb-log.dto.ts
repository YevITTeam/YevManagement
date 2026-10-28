// Schema theo docs/docs-be/asset-module.md §1.24 — nhật ký USB do agent trên PC gửi về, FE chỉ đọc.
// Mỗi PC có hoạt động USB (gom theo tên máy; deviceId null = tên máy chưa khớp thiết bị nào).
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
    // false = máy chưa được cấp phép lúc cắm (BE đã tự bật IsUseUsb); null = tên máy không khớp thiết bị nào.
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
