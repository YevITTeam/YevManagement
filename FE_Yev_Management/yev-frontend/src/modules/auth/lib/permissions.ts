import type { UserDto } from "@/modules/auth/types/auth.dto";

// FE chỉ dùng permission để ẩn/hiện UI — BE luôn tự enforce lại ở tầng API (xem docs/identity-api-fe.md §3).
export const hasPermission = (user: UserDto | null | undefined, code: string): boolean => {
    return Boolean(user?.permissions?.includes(code));
};

export const hasAnyPermission = (user: UserDto | null | undefined, codes: string[]): boolean => {
    if (!user?.permissions?.length) return false;
    return codes.some((code) => user.permissions.includes(code));
};
