export interface EmployeeSignatureDto {
    employeeId: number;
    // Base64 without the data:image/...;base64, prefix.
    signatureImage: string;
    updatedAt: string;
}

export interface UpsertEmployeeSignatureDto {
    signatureImage: string;
}

// Pending (not yet applied) signature shown on the confirm page.
export interface SignatureConfirmationPreviewDto {
    employeeFullName: string;
    signatureImage: string;
    expiresAt: string;
}
