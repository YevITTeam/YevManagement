// docs/attendance-module.md §API — import Excel nhân sự hàng loạt (Admin), pattern Preview → Confirm.

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

// Import hàng loạt giới hạn OT tháng/năm riêng từng nhân viên (mục 5, 2026-08-27). KHÔNG có bước
// Preview/Confirm — file Excel cột B=MNV, C=Giới hạn Tháng, D=Giới hạn Năm, áp dụng thẳng, trả lại kết
// quả từng dòng để xem lại. Ô Giới hạn để trống ở 1 dòng = giữ nguyên override cũ của nhân viên đó.
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
