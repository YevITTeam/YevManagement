export interface OrgLevelDto {
    id: number;
    levelNumber: number;
    nameVn: string;
    nameJp: string | null;
}

export interface CreateUpdateOrgLevelDto {
    levelNumber: number;
    nameVn: string;
    nameJp: string | null;
}
