// Import Excel hàng loạt liên kết Employee (Attendance) ↔ User (Identity), tự tạo tài khoản Identity
// nếu chưa có + gán chữ ký thẳng — Admin-only (2026-09-03). Preview VÀ Confirm đều gửi lại NGUYÊN file
// (không gửi rows qua JSON như các import khác) vì mỗi dòng có thể kèm 1 ảnh chữ ký nhúng.
//
// Mở rộng 2026-09-03b: thêm Chức vụ (jobTitleCode) + Người phụ trách Cây duyệt (isCoordinator) — cả 2
// đều áp theo phạm vi Bộ phận/Nhóm HIỆN TẠI của Employee, không chọn phạm vi khác trong file này.

export interface EmployeeIdentityLinkImportRowDto {
    rowNumber: number;
    employeeCode: string | null;
    userName: string | null;
    roleName: string | null;
    jobTitleCode: string | null;
    isCoordinator: boolean;
    hasSignatureImage: boolean;
    resolvedEmployeeFullName: string | null;
    identityUserAlreadyExists: boolean;
    currentUserNameOnEmployee: string | null;
    resolvedJobTitleName: string | null;
    coordinatorScopeDescription: string | null;
    isValid: boolean;
    errors: string[];
}

export interface EmployeeIdentityLinkImportPreviewResultDto {
    rows: EmployeeIdentityLinkImportRowDto[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    newIdentityUserCount: number;
    rowsWithSignatureCount: number;
    rowsWithJobTitleCount: number;
    rowsWithCoordinatorCount: number;
}

export interface EmployeeIdentityLinkImportSkippedRowDto {
    rowNumber: number;
    employeeCode: string | null;
    errors: string[];
}

export interface EmployeeIdentityLinkImportConfirmResultDto {
    successCount: number;
    createdIdentityUserCount: number;
    signatureSetCount: number;
    jobTitleAssignedCount: number;
    coordinatorAddedCount: number;
    skippedCount: number;
    skippedRows: EmployeeIdentityLinkImportSkippedRowDto[];
}
