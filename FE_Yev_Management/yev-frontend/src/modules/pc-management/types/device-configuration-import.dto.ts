// Xem docs/asset-api-fe.md §6.3 — import cấu hình phần cứng hàng loạt từ file kiểm kê Tanium.
// Khác device-import: CHỈ cập nhật Device đã có sẵn, không tự tạo Device mới.

// Dữ liệu thô đọc được từ 1 dòng file Tanium — dùng chung cho response preview và request confirm.
export interface DeviceConfigurationImportRowDto {
    computerName: string;
    taniumIpAddress: string | null;
    manufacturer: string | null;
    model: string | null;
    cpu: string | null;
    ram: string | null;
    size: string | null;
}

// Item trả về từ bước preview — thêm mã/tên tách được, các Id đã tra sẵn + kết quả validate.
export interface DeviceConfigurationImportPreviewRowDto extends DeviceConfigurationImportRowDto {
    rowNumber: number;
    parsedDeviceCode: string;
    parsedDeviceName: string;
    resolvedDeviceId: number | null;
    resolvedIpAddressId: number | null;
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface DeviceConfigurationImportPreviewResultDto {
    rows: DeviceConfigurationImportPreviewRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    // Số dòng Computer Name không thuộc 5 họ mã (YDC/YLC/YDF/AC/TYC), bị loại thầm lặng trước khi vào "rows".
    outOfScopeSkippedCount: number;
}

export interface DeviceConfigurationImportConfirmResultDto {
    createdConfigCount: number;
    updatedConfigCount: number;
    ipReassignedCount: number;
    updatedDeviceIds: number[];
}
