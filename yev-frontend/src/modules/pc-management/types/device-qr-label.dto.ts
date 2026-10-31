// BE returns data only (fields + prebuilt qrPayload); FE renders the QR and print layout.
export interface DeviceQrLabelDto {
    deviceId: number;
    deviceCode: string;
    deviceName: string;
    deviceTypeName: string;
    branchName: string;
    supplierName: string;
    manager: string;
    serialNumber: string | null;
    statusText: string;
    purchaseDate: string;
    // Line 1 must stay deviceCode (the internal app splits it out for lookup), even when FE rebuilds the payload.
    qrPayload: string;
}
