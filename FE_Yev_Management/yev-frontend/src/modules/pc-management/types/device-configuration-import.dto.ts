// Xem docs/asset-api-fe.md §6.3 — import cấu hình phần cứng hàng loạt từ file kiểm kê Tanium.
// Khác device-import: CHỈ cập nhật Device đã có sẵn, không tự tạo Device mới.

// Dữ liệu thô đọc được từ 1 dòng file Tanium — dùng chung cho response preview và request confirm.
// 2026-07-23: format mới 9 cột — thêm cột F "Computer Serial Number" (serialNumber) ghi vào
// Device.SerialNumber. File xuất theo format cũ 8 cột (không có cột này) sẽ đọc lệch cột.
export interface DeviceConfigurationImportRowDto {
    computerName: string;
    taniumIpAddress: string | null;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
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
    // null = serial sẽ KHÔNG được ghi (trống, đang thuộc Device khác, hoặc lặp nhiều dòng trong file).
    resolvedSerialNumber: string | null;
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

// Response của BE KHÔNG có skippedRows/skippedCount (khác Device Import) — endpoint
// này vẫn re-validate + atomic theo request gửi lên (xem docs/asset-api-fe.md §6.3).
// Để cho phép Confirm dù còn dòng lỗi mà không rủi ro bị BE từ chối cả batch, FE tự
// lọc bỏ các dòng isValid=false trước khi gửi (xem ImportDeviceConfigurationDialog).
export interface DeviceConfigurationImportConfirmResultDto {
    createdConfigCount: number;
    updatedConfigCount: number;
    ipReassignedCount: number;
    serialUpdatedCount: number;
    updatedDeviceIds: number[];
}
