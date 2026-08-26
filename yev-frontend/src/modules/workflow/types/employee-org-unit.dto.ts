export interface EmployeeOrgUnitDto {
    id: number;
    orgUnitId: number;
    orgUnitCode: string;
    orgUnitNameVn: string;
    jobTitleId: number | null;
    jobTitleNameVn: string | null;
    isPrimary: boolean;
    validFrom: string | null;
    validTo: string | null;
}

// PUT /Workflow/Employee/{id}/org-units thay NGUYÊN danh sách — không có id riêng từng dòng,
// gửi cả mảng item để BE xoá hết rồi tạo lại (workflow-module.md §6).
export interface ReplaceEmployeeOrgUnitItemDto {
    orgUnitId: number;
    jobTitleId: number | null;
    isPrimary: boolean;
    validFrom: string | null;
    validTo: string | null;
}
