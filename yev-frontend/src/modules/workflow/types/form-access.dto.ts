// workflow-module.md §3.2 FormAccesses — khớp enum AccessTargetType ở BE (Workflow.Domain.Enums).
export const AccessTargetType = {
    Role: 1,
    OrgUnit: 2,
    Employee: 3,
} as const;

export type AccessTargetType = (typeof AccessTargetType)[keyof typeof AccessTargetType];

// RoleId là cross-DB (Identity.Roles, workflow-module.md §1.4) — BE không resolve được tên Role,
// FE tự ánh xạ bằng danh sách AuthApi.getAllRoles().
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
