export interface EmployeeSignatureDto {
    employeeId: number;
    // Base64 (không kèm prefix data:image/...;base64,).
    signatureImage: string;
    updatedAt: string;
}

export interface UpsertEmployeeSignatureDto {
    signatureImage: string;
}

// GET /api/Workflow/EmployeeSignature/confirm/{token} — ảnh chữ ký ĐANG CHỜ xác nhận (chưa áp dụng).
export interface SignatureConfirmationPreviewDto {
    employeeFullName: string;
    signatureImage: string;
    expiresAt: string;
}
