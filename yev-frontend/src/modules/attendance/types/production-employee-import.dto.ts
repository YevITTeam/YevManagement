// docs/attendance-api-fe.md §Import nhân sự dưới chuyền — pattern Preview → Confirm, giống EmployeeImport
// nhưng cho phép tự tạo Employee thiếu, và tách riêng bước "Áp dụng lũy kế" (ảnh hưởng lương).

export interface ProductionEmployeeImportRowDto {
    rowNumber: number;
    employeeCode: string | null;
    lastName: string | null;
    firstName: string | null;
    congDoan: string | null;
    taskName: string | null;
    blockCode: string | null;
    teamCode: string | null;
    shiftTeamCode: string | null;
    isLeader: boolean;

    otMonthHours: number | null;
    otYearHours: number | null;

    resolvedProductionLineId: number | null;
    resolvedTeamId: number | null;
    resolvedShiftTeamId: number | null;

    isNewEmployee: boolean;
    isNewProductionEmployee: boolean;
    isUpdatedProductionEmployee: boolean;

    isValid: boolean;
    errors: string[];
}

export interface ProductionEmployeeRemovedRowDto {
    employeeCode: string;
    fullName: string;
}

export interface ProductionEmployeeImportPreviewResultDto {
    rows: ProductionEmployeeImportRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    newEmployeeCount: number;
    newProductionEmployeeCount: number;
    updatedProductionEmployeeCount: number;
    unchangedProductionEmployeeCount: number;
    removedProductionEmployeeCount: number;
    removedRows: ProductionEmployeeRemovedRowDto[];
}

export interface ProductionEmployeeImportSkippedRowDto {
    rowNumber: number;
    employeeCode: string | null;
    errors: string[];
}

export interface ProductionEmployeeImportConfirmResultDto {
    createdGroupCount: number;
    createdEmployeeCount: number;
    createdProductionEmployeeCount: number;
    updatedProductionEmployeeCount: number;
    removedProductionEmployeeCount: number;
    skippedCount: number;
    skippedRows: ProductionEmployeeImportSkippedRowDto[];
}

export interface ProductionEmployeeAccumulationSkippedRowDto {
    employeeCode: string | null;
    reason: string;
}

export interface ProductionEmployeeAccumulationResultDto {
    adjustedCount: number;
    unchangedCount: number;
    skippedCount: number;
    skippedRows: ProductionEmployeeAccumulationSkippedRowDto[];
    totalDeltaHours: number;
    adjustedYearCount?: number;
    totalDeltaYearHours?: number;
}
