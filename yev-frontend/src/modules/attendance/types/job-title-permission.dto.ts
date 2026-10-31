// Identity permissions auto-granted to holders of a job title; only codes from GET /JobTitlePermission/allowed-codes are allowed.
export interface JobTitlePermissionDto {
    id: number;
    jobTitleId: number;
    permissionCode: string;
}
