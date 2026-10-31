// Only moves devices from Pending liquidation (2) to Liquidated (3); never creates or deletes devices.

// Raw row data, shared by the preview response and the confirm request.
export interface DeviceLiquidationImportRowDto {
    deviceCode: string;
}

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
