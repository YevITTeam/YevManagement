export interface FormCategoryDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgUnitId: number | null;
    orgUnitNameVn: string | null;
    sortOrder: number;
}

export interface CreateUpdateFormCategoryDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
    orgUnitId: number | null;
    sortOrder: number;
}
