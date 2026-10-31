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

// PUT replaces the whole list (BE deletes and recreates), so rows carry no id.
export interface ReplaceEmployeeOrgUnitItemDto {
    orgUnitId: number;
    jobTitleId: number | null;
    isPrimary: boolean;
    validFrom: string | null;
    validTo: string | null;
}
