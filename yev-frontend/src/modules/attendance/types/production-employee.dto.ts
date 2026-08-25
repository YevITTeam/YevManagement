export interface ProductionEmployeeSearchItemDto {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    congDoan: string | null;
    taskName: string | null;
    blockCode: string | null;
    teamCode: string | null;
    shiftTeamCode: string | null;
    shiftTeamNameVn: string | null;
    isLeader: boolean;
}

export interface ProductionOptionDto {
    id: number;
    code: string;
    nameVn: string | null;
}
