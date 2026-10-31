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
    isLeader: boolean;
}

export interface ProductionOptionDto {
    id: number;
    code: string;
    nameVn: string | null;
}

// Read-only; edited only by re-importing the Excel file.
export interface ProductionEmployeeListItemDto {
    id: number;
    employeeId: number | null;
    employeeCode: string;
    fullName: string;
    congDoan: string | null;
    taskName: string | null;
    blockCode: string | null;
    productionLineId: number | null;
    teamCode: string | null;
    teamNameVn: string | null;
    teamId: number | null;
    shiftTeamCode: string | null;
    shiftTeamNameVn: string | null;
    shiftTeamId: number | null;
    isLeader: boolean;
    departmentNameVn: string | null;
    monthToDate: number;
    yearToDate: number;
}
