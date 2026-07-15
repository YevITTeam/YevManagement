export interface UserSignatureDto {
    userName: string;
    // Base64 (không kèm prefix data:image/...;base64,) — docs/attendance-api-fe.md đầu file.
    signatureImage: string;
    updatedAt: string;
}

export interface UpsertUserSignatureDto {
    signatureImage: string;
}
