import type { UserDto } from "@/modules/auth/types/auth.dto";

// FE chỉ dùng permission để ẩn/hiện UI — BE luôn tự enforce lại ở tầng API (xem docs/identity-api-fe.md §3).
// Khu vực Admin hiện nếu user có ít nhất 1 permission quản trị Identity — dùng cho menu Header và guard route /admin.
export const IDENTITY_ADMIN_PERMISSIONS = [
    "Identity.User.View",
    "Identity.User.UpdateRoles",
    "Identity.Role.View",
    "Identity.Permission.View",
];

export const hasPermission =(user: UserDto | null | undefined, code: string): boolean => {
    return Boolean(user?.permissions?.includes(code));
};

export const hasAnyPermission = (user: UserDto | null | undefined, codes: string[]): boolean => {
    if (!user?.permissions?.length) return false;
    return codes.some((code) => user.permissions.includes(code));
};

// Kiểm tra user có ít nhất 1 permission thuộc 1 module (vd "Asset") hay không — dùng để ẩn/hiện cả
// 1 khu vực chức năng (menu trang chủ, route guard) mà không cần liệt kê hết mã permission con.
export const hasModuleAccess = (user: UserDto | null | undefined, modulePrefix: string): boolean => {
    if (!user?.permissions?.length) return false;
    return user.permissions.some((code) => code.startsWith(`${modulePrefix}.`));
};
