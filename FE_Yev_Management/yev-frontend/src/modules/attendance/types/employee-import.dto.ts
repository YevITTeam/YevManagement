// docs/attendance-api-fe.md §3.7 — import Excel nhân sự hàng loạt (Admin), pattern Preview → Confirm.

export interface EmployeeImportPreviewRowDto {
    rowNumber: number;
    employeeCode: string;
    fullName: string;
    departmentCode: string;
    departmentNameVn: string;
    groupCode: string;
    groupNameVn: string;
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
    skippedCount: number;
    skippedRows: SkippedEmployeeImportRowDto[];
}
