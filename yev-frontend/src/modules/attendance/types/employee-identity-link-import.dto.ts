// Preview and Confirm both re-send the whole file: rows may carry embedded signature images.

export interface EmployeeIdentityLinkImportRowDto {
    rowNumber: number;
    employeeCode: string | null;
    userName: string | null;
    email: string | null;
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
    emailSetCount: number;
    signatureSetCount: number;
    jobTitleAssignedCount: number;
    coordinatorAddedCount: number;
    skippedCount: number;
    skippedRows: EmployeeIdentityLinkImportSkippedRowDto[];
}
