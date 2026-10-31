// Shared by preview and confirm; branch, supplier and device type columns are matched by code, not name.
export interface DeviceImportRowDto {
    rowNumber: number;
    deviceCode: string;
    branchCode: string;
    deviceTypeCode: string;
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

// An existing device code is not an error: resolvedExistingDeviceId/isUpdate mean the row updates an unused device.
export interface DeviceImportPreviewRowDto extends DeviceImportRowDto {
    resolvedBranchId: number | null;
    resolvedDeviceTypeId: number | null;
    resolvedSupplierId: number | null;
    resolvedOldDeviceId: number | null;
    resolvedExistingDeviceId: number | null;
    isUpdate: boolean;
    isValid: boolean;
    errors: string[];
}

export interface DeviceImportPreviewResultDto {
    rows: DeviceImportPreviewRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
}

// Only prefills the Transfer screen; nothing moves until the user confirms (POST /api/TransferHistory).
export interface DeviceImportPendingTransferDto {
    newDeviceId: number;
    newDeviceCode: string;
    oldDeviceId: number;
    oldDeviceCode: string;
}

// Confirm skips only the invalid rows instead of rejecting the whole batch.
export interface DeviceImportSkippedRowDto {
    rowNumber: number;
    deviceCode: string;
    errors: string[];
}

export interface DeviceImportConfirmResultDto {
    createdCount: number;
    createdDeviceIds: number[];
    updatedCount: number;
    updatedDeviceIds: number[];
    createdConfigCount: number;
    updatedConfigCount: number;
    pendingTransfers: DeviceImportPendingTransferDto[];
    skippedCount: number;
    skippedRows: DeviceImportSkippedRowDto[];
}
