import type { UserDto } from "@/modules/auth/types/auth.dto";

// FE permissions only toggle UI; BE always enforces at the API.
// Admin area shows if the user holds any Identity admin permission (Header menu + /admin guard).
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

// Gates a whole area (home menu, route guard) without listing every permission code.
export const hasModuleAccess = (user: UserDto | null | undefined, modulePrefix: string): boolean => {
    if (!user?.permissions?.length) return false;
    return user.permissions.some((code) => code.startsWith(`${modulePrefix}.`));
};
