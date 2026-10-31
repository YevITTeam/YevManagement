export interface JobTitleDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    rankOrder: number;
    // true = only one holder per unit at a time; false = many holders allowed (e.g. staff).
    isUniquePerOrgUnit: boolean;
}

export interface CreateUpdateJobTitleDto {
    code: string;
    nameVn: string;
    nameJp: string | null;
    rankOrder: number;
    isUniquePerOrgUnit: boolean;
}
