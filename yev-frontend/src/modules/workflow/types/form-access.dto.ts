// Must match BE enum AccessTargetType.
export const AccessTargetType = {
    Role: 1,
    OrgUnit: 2,
    Employee: 3,
} as const;

export type AccessTargetType = (typeof AccessTargetType)[keyof typeof AccessTargetType];

// RoleId lives in the Identity DB so BE can't resolve the name; FE maps it via AuthApi.getAllRoles().
export interface FormAccessDto {
    id: number;
    targetType: AccessTargetType;
    roleId: number | null;
    orgUnitId: number | null;
    orgUnitNameVn: string | null;
    employeeId: number | null;
    employeeFullName: string | null;
}

export interface ReplaceFormAccessItemDto {
    targetType: AccessTargetType;
    roleId: number | null;
    orgUnitId: number | null;
    employeeId: number | null;
}
