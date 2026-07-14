// Xem docs/asset-api-fe.md §5.10 — import Device hàng loạt từ Excel, quy trình 2 bước preview/confirm.

// Dữ liệu thô đọc được từ 1 dòng Excel — dùng chung cho response preview và request confirm.
// 2026-07-11: thêm 5 cột cấu hình (Hãng/Model/CPU/RAM/Ổ Cứng) giữa "Số SerialNumber" và "MQL Cũ".
// 2026-07-13: cột "Xưởng"/"Nhà Cung Cấp" đổi khớp theo Mã (branchCode/supplierCode) thay vì Tên.
export interface DeviceImportRowDto {
    rowNumber: number;
    deviceCode: string;
    branchCode: string;
    deviceTypeName: string;
    supplierCode: string;
    purchaseDate: string;
    note: string | null;
    serialNumber: string | null;
    maker: string | null;
    model: string | null;
    cpu: string | null;
    ram: string | null;
    hardDrive: string | null;
    oldDeviceCode: string | null;
}

// Item trả về từ bước preview — thêm các Id đã tra sẵn + kết quả validate.
export interface DeviceImportPreviewRowDto extends DeviceImportRowDto {
    resolvedBranchId: number | null;
    resolvedDeviceTypeId: number | null;
    resolvedSupplierId: number | null;
    resolvedOldDeviceId: number | null;
    isValid: boolean;
    errors: string[];
}

export interface DeviceImportPreviewResultDto {
    rows: DeviceImportPreviewRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
}

// Gợi ý "chuyển máy" suy ra từ cột "MQL Cũ" — KHÔNG tự thực hiện, chỉ điền sẵn
// (cho sửa) trên màn hình "Chuyển máy"; người dùng phải tự bấm "Chuyển" mới
// thật sự gọi POST /api/TransferHistory.
export interface DeviceImportPendingTransferDto {
    newDeviceId: number;
    newDeviceCode: string;
    oldDeviceId: number;
    oldDeviceCode: string;
}

// Dòng bị bỏ qua ở bước Confirm vì còn lỗi validate (2026-07-11: Confirm không
// còn chặn cả batch, chỉ bỏ qua đúng dòng lỗi).
export interface DeviceImportSkippedRowDto {
    rowNumber: number;
    deviceCode: string;
    errors: string[];
}

export interface DeviceImportConfirmResultDto {
    createdCount: number;
    createdDeviceIds: number[];
    createdConfigCount: number;
    pendingTransfers: DeviceImportPendingTransferDto[];
    skippedCount: number;
    skippedRows: DeviceImportSkippedRowDto[];
}
