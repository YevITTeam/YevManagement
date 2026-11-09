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
    // Actual + other pending forms; only meaningful when ProductionEmployeeApi.search is called with `date`.
    projectedDayToDate: number;
    projectedMonthToDate: number;
    projectedYearToDate: number;
    // Per-employee monthly/yearly limits; null = global default.
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
}

// All three Ids are nullable; clearing one unassigns it.
export interface UpdateProductionEmployeeDto {
    productionLineId: number | null;
    teamId: number | null;
    shiftTeamId: number | null;
    congDoan: string | null;
    taskName: string | null;
}

export interface ProductionOptionDto {
    id: number;
    code: string;
    nameVn: string | null;
}
