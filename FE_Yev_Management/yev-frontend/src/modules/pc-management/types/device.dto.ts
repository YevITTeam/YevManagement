export interface DeviceDto {
    id: number;
    deviceCode: string;
    deviceName: string;
    branchName: string;
    supplierName: string;
    deviceTypeName: string;
    ipAddress: string | null;
    purchaseDate: string | null;
    manager: string;
    expirationDate: string | null;
    note: string | null;
    email: string | null;
    status: number;
}