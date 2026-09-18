export interface DeviceTypeDto {
    id: number;
    typeCode: string;
    typeName: string;
    // null = không thuộc phạm vi kiểm tra hằng ngày qua QR (0=Server/1=Network/2=Ups/3=Máy lạnh).
    serverCheckCategory?: number | null;
    serverCheckCategoryText?: string | null;
}
