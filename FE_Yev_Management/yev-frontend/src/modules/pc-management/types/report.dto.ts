export interface DeviceListReportItemDto {
    stt: number;
    deviceCode: string;
    deviceName: string;
    ipAddress: string | null;
    purchaseDate: string | null;
    expirationDate: string | null;
    isExpired: boolean;
    financialPeriod: number | null;
    note: string | null;
}
