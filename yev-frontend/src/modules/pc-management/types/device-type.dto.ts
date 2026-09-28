export interface DeviceTypeDto {
    id: number;
    typeCode: string;
    typeName: string;
    // null = không thuộc phạm vi kiểm tra hằng ngày qua QR (0=Server/1=Network/2=Ups).
    serverCheckCategory?: number | null;
    serverCheckCategoryText?: string | null;
    // true = thiết bị loại này phải quét QR khi kiểm tra hằng ngày; false = hệ thống tự ping lúc kết thúc phiên.
    requiresQrScan?: boolean;
    // true = loại này được đưa vào đợt kiểm kê thiết bị (asset-module.md §1.22).
    includedInInventory?: boolean;
}
