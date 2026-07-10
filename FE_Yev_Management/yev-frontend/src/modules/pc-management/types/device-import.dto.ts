// Xem docs/asset-api-fe.md §5.10 — import Device hàng loạt từ Excel, quy trình 2 bước preview/confirm.

// Dữ liệu thô đọc được từ 1 dòng Excel — dùng chung cho response preview và request confirm.
export interface DeviceImportRowDto {
    rowNumber: number;
    deviceCode: string;
    branchName: string;
    deviceTypeName: string;
    supplierName: string;
    purchaseDate: string;
    note: string | null;
    serialNumber: string | null;
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

export interface DeviceImportConfirmResultDto {
    createdCount: number;
    replacedOldDeviceCount: number;
    createdDeviceIds: number[];
}
