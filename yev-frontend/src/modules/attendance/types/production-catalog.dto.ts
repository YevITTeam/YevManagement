export type ProductionCatalogKind = "Line" | "Team" | "ShiftTeam" | "Task";

export interface ProductionCatalogItemDto {
    id: number;
    code: string;
    nameVn: string | null;
    workshopId: number | null;
    workshopCode: string | null;
    teamId: number | null;
    teamCode: string | null;
    congDoan: string | null;
    cdMae: string | null;
    sortCode: string | null;
    // Task only.
    staffKind: string | null;
    employeeCount: number;
}

export interface SaveProductionCatalogItemDto {
    code: string;
    nameVn: string | null;
    // Required for Line, Team and Task; shift teams are shared by every workshop.
    workshopId: number | null;
    teamId: number | null;
    congDoan: string | null;
    cdMae: string | null;
    sortCode: string | null;
    staffKind: string | null;
}
