export type ProductionCatalogKind = "Line" | "Team" | "ShiftTeam";

export interface ProductionCatalogItemDto {
    id: number;
    code: string;
    nameVn: string | null;
    teamId: number | null;
    teamCode: string | null;
    congDoan: string | null;
    employeeCount: number;
}

export interface SaveProductionCatalogItemDto {
    code: string;
    nameVn: string | null;
    teamId: number | null;
    congDoan: string | null;
}
