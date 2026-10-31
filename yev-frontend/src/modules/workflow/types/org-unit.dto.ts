export interface OrgUnitDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgLevelId: number;
    orgLevelNameVn: string;
    parentId: number | null;
    parentNameVn: string | null;
    sortOrder: number;
    validFrom: string | null;
    validTo: string | null;
}

// Active employees only.
export interface OrgUnitTreeMemberDto {
    // EmployeeOrgUnits.Id, used to update/remove a single assignment.
    assignmentId: number;
    employeeId: number;
    employeeFullName: string;
    employeeCode: string;
    jobTitleId: number | null;
    jobTitleNameVn: string | null;
    // Lower = higher level; only used for tree grouping/indentation.
    jobTitleRankOrder: number | null;
    isPrimary: boolean;
}

export interface OrgUnitTreeDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgLevelId: number;
    sortOrder: number;
    members: OrgUnitTreeMemberDto[];
    children: OrgUnitTreeDto[];
}

export interface ReorderOrgUnitItemDto {
    id: number;
    parentId: number | null;
    sortOrder: number;
}

export interface CreateUpdateOrgUnitDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgLevelId: number;
    parentId: number | null;
    sortOrder: number;
    validFrom: string | null;
    validTo: string | null;
}
