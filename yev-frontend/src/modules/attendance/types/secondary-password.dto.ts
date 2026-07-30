// GET /api/SecondaryPassword/me — không bao giờ trả hash/plaintext, chỉ trạng thái đã đăng ký hay chưa.
export interface SecondaryPasswordStatusDto {
    isRegistered: boolean;
    updatedAt: string | null;
}

export interface UpsertSecondaryPasswordDto {
    password: string;
}

// GET /api/SecondaryPassword/confirm/{token} — trang xác nhận qua email, không trả lại mật khẩu.
export interface SecondaryPasswordConfirmationPreviewDto {
    userName: string;
    expiresAt: string;
}
