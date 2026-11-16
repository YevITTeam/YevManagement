// One Line × Ca the group covers; codes are filled on read only.
export interface GroupLineDto {
    productionLineId: number;
    shiftTeamId: number;
    lineCode?: string | null;
    shiftTeamCode?: string | null;
}

export interface GroupDto {
    id: number;
    groupCode: string;
    groupNameVn: string;
    groupNameJp: string | null;
    departmentId: number;
    departmentNameVn: string;
    workshopId: number;
    workshopNameVn: string;
    allowEatLater: boolean;
    // TT/GT of everyone in the group; set whenever lines is not empty.
    lineKind: string | null;
    lines: GroupLineDto[];
}
