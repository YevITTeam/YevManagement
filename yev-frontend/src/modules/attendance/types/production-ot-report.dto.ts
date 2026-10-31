export interface ProductionTicketReportRowDto {
    congDoan: string;
    ca: string;
    team: string;
    lineCa: string;
    secondaryTicketCount: number;
    mainTicketCount: number;
    milkCount: number;
    totalHour: number;
    startTime: string;
    endTime: string;
}

export interface ProductionTicketReportDto {
    date: string;
    totalSecondaryTicketCount: number;
    totalMainTicketCount: number;
    totalMilkCount: number;
    rows: ProductionTicketReportRowDto[];
}

// Data for bulk-printing YEV-22-024 per line/group/day; signatures/reasons come from getOtFormById(primaryOtFormId),
// only employees/numberOfEmployee are overridden from here.
export interface ProductionTicketBatchEmployeeDto {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    startTime: string;
    endTime: string;
    monthToDate: number;
    yearToDate: number;
    noteVn: string | null;
    // Needed to build the same process-name cell as the single print (getProductionCongDoanLabel).
    congDoanSnapshot: string | null;
    taskNameSnapshot: string | null;
    blockCodeSnapshot: string | null;
    teamCodeSnapshot: string | null;
    shiftTeamCodeSnapshot: string | null;
}

export interface ProductionTicketBatchGroupDto {
    primaryOtFormId: number;
    block: string;
    shiftTeam: string;
    employeeCount: number;
    employees: ProductionTicketBatchEmployeeDto[];
}
