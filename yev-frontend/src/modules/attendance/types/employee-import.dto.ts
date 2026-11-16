
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
    // true = only people marked resigned, false = only working people.
    resigned?: boolean;
}

// Overwrite: the file is the full roster of its departments (line data picks the group, absentees become resigned).
// Add: only listed people change, a filled group code wins.
export type EmployeeImportMode = 1 | 2;
export const EMPLOYEE_IMPORT_MODE = { overwrite: 1, add: 2 } as const;

export interface EmployeeImportPreviewRowDto {
    rowNumber: number;
    employeeCode: string;
    fullName: string;
    departmentCode: string | null;
    departmentNameVn: string | null;
    groupCode: string | null;
    groupNameVn: string | null;
    workshopCode: string | null;
    lineCode: string | null;
    teamCode: string | null;
    shiftTeamCode: string | null;
    congDoan: string | null;
    taskName: string | null;
    // TT/GT as resolved by the preview.
    staffKind: string | null;
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
    groupNameVn: string | null;
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
    resignedCount: number;
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
