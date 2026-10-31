// Never returns hash/plaintext, only whether one is registered.
export interface SecondaryPasswordStatusDto {
    isRegistered: boolean;
    updatedAt: string | null;
}

export interface UpsertSecondaryPasswordDto {
    password: string;
}

// Does not return the password.
export interface SecondaryPasswordConfirmationPreviewDto {
    userName: string;
    expiresAt: string;
}
