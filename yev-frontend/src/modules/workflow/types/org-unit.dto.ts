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

// Cây dựng từ GET /Workflow/OrgUnit/tree — dùng cho màn quản trị cây tổ chức.
export interface OrgUnitTreeDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgLevelId: number;
    sortOrder: number;
    children: OrgUnitTreeDto[];
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
