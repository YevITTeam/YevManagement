export interface UserSignatureDto {
    userName: string;
    // Base64 without the data: prefix.
    signatureImage: string;
    updatedAt: string;
}

export interface UpsertUserSignatureDto {
    signatureImage: string;
}

// Pending (not yet applied) signature image.
export interface SignatureConfirmationPreviewDto {
    userName: string;
    signatureImage: string;
    expiresAt: string;
}
