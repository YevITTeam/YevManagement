export interface UserSignatureDto {
    userName: string;
    // Base64 (không kèm prefix data:image/...;base64,) — docs/attendance-module.md §API đầu file.
    signatureImage: string;
    updatedAt: string;
}

export interface UpsertUserSignatureDto {
    signatureImage: string;
}

// GET /api/UserSignature/confirm/{token} — docs §6b. Ảnh chữ ký ĐANG CHỜ xác nhận (chưa áp dụng).
export interface SignatureConfirmationPreviewDto {
    userName: string;
    signatureImage: string;
    expiresAt: string;
}
