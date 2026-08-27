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

// 1 dòng "ai đang giữ chức gì" kèm theo mỗi node cây (chỉ nhân sự còn hoạt động).
export interface OrgUnitTreeMemberDto {
    employeeId: number;
    employeeFullName: string;
    employeeCode: string;
    jobTitleId: number | null;
    jobTitleNameVn: string | null;
    // Số nhỏ = cao hơn — dùng để nhóm/thụt lề kiểu cây thư mục trên FE, không có ý nghĩa nghiệp vụ nào khác.
    jobTitleRankOrder: number | null;
    isPrimary: boolean;
}

// Cây dựng từ GET /Workflow/OrgUnit/tree — dùng cho màn quản trị cây tổ chức.
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
