// Xem docs/asset-module.md §4 — import thanh lý hàng loạt từ file 1 cột "Mã máy".
// Chỉ đổi status máy đang "Chờ thanh lý" (2) sang "Đã thanh lý" (3), không tạo/xoá thiết bị.

// Dữ liệu thô 1 dòng file — dùng chung cho response preview và request confirm.
export interface DeviceLiquidationImportRowDto {
    deviceCode: string;
}

// Item trả về từ bước preview — thêm Id đã tra sẵn + trạng thái hiện tại + kết quả validate.
export interface DeviceLiquidationImportPreviewRowDto extends DeviceLiquidationImportRowDto {
    rowNumber: number;
    resolvedDeviceId: number | null;
    currentStatus: number;
    currentStatusText: string;
    isValid: boolean;
    errors: string[];
}

export interface DeviceLiquidationImportPreviewResultDto {
    rows: DeviceLiquidationImportPreviewRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
}

export interface DeviceLiquidationImportSkippedRowDto {
    rowNumber: number;
    deviceCode: string;
    errors: string[];
}

export interface DeviceLiquidationImportConfirmResultDto {
    liquidatedCount: number;
    liquidatedDeviceIds: number[];
    releasedIpCount: number;
    releasedSoftwareCount: number;
    skippedCount: number;
    skippedRows: DeviceLiquidationImportSkippedRowDto[];
}
