// Permission codes are fixed (seeded by BE migrations); FE is read-only.
export interface PermissionDto {
    id: number;
    code: string;
    module: string;
    description: string;
}

// Only GET /api/Permission/all is grouped Module > Entity; other permission endpoints return flat PermissionDto[].
export interface PermissionEntityGroupDto {
    entity: string;
    permissions: PermissionDto[];
}

export interface PermissionModuleGroupDto {
    module: string;
    entities: PermissionEntityGroupDto[];
}

// Per-user override on top of role permissions: isGranted=false revokes, true grants extra.
export interface UserPermissionOverrideDto {
    permissionId: number;
    code: string;
    module: string;
    description: string;
    isGranted: boolean;
    // Auto-granted by the Attendance job title; FE excludes these from the PUT payload so saving
    // doesn't convert them into manual overrides.
    isAutoGranted: boolean;
}

// Full replacement set; an id in both arrays gets a 400.
export interface UpdateUserPermissionOverridesDto {
    grantPermissionIds: number[];
    denyPermissionIds: number[];
}
