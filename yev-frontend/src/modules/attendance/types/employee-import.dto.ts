
// Filters of the employee list, sent to the "export filtered" endpoints.
export interface EmployeeExportFilter {
    keyword?: string;
    departmentId?: number;
    groupId?: number;
    workshopId?: number;
    productionLineId?: number;
    teamId?: number;
    shiftTeamId?: number;
    congDoan?: string;
}

export interface EmployeeImportPreviewRowDto {
    rowNumber: number;
    employeeCode: string;
    fullName: string;
    departmentCode: string;
    departmentNameVn: string;
    groupCode: string;
    groupNameVn: string;
    lineCode: string | null;
    teamCode: string | null;
    shiftTeamCode: string | null;
    congDoan: string | null;
    taskName: string | null;
    resolvedFirstName: string | null;
    resolvedLastName: string | null;
    isNewDepartment: boolean;
    isNewGroup: boolean;
    isNewEmployee: boolean;
    isValid: boolean;
    errors: string[];
}

export interface EmployeeImportPreviewResultDto {
    rows: EmployeeImportPreviewRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    newDepartmentCount: number;
    newGroupCount: number;
    removedRows: EmployeeImportRemovedRowDto[];
}

export interface EmployeeImportRemovedRowDto {
    employeeCode: string;
    fullName: string;
    lineCode: string | null;
}

export interface SkippedEmployeeImportRowDto {
    rowNumber: number;
    employeeCode: string;
    errors: string[];
}

export interface EmployeeImportConfirmResultDto {
    createdDepartmentCount: number;
    createdGroupCount: number;
    createdEmployeeCount: number;
    updatedEmployeeCount: number;
    removedFromLineCount: number;
    skippedCount: number;
    skippedRows: SkippedEmployeeImportRowDto[];
}

// Applied directly (no Preview/Confirm); columns B=employee code, C=monthly, D=yearly limit.
// An empty limit cell keeps the employee's existing override.
export interface EmployeeOtHourLimitImportRowResultDto {
    rowNumber: number;
    employeeCode: string;
    success: boolean;
    error: string | null;
    monthlyLimit: number | null;
    yearlyLimit: number | null;
}

export interface EmployeeOtHourLimitImportResultDto {
    updatedCount: number;
    skippedCount: number;
    rows: EmployeeOtHourLimitImportRowResultDto[];
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
