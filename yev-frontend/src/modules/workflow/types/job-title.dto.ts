export interface JobTitleDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    rankOrder: number;
    // true = tại 1 đơn vị chỉ 1 người được giữ chức danh này cùng lúc (workflow-module.md §3.1, §10 —
    // chốt 2026-08-26). false = chức danh phổ thông, nhiều người cùng giữ được (vd "Nhân viên").
    isUniquePerOrgUnit: boolean;
}

export interface CreateUpdateJobTitleDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
    rankOrder: number;
    isUniquePerOrgUnit: boolean;
}
