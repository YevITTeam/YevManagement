export interface DeviceTypeDto {
    id: number;
    typeCode: string;
    typeName: string;
    // null = outside the daily QR check (0=Server/1=Network/2=Ups).
    serverCheckCategory?: number | null;
    serverCheckCategoryText?: string | null;
    // false = the system pings it when the session ends instead of a QR scan.
    requiresQrScan?: boolean;
    includedInInventory?: boolean;
}
