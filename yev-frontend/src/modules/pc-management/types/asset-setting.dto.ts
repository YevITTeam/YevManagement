// Single settings record (no id, no paging).
export interface AssetSettingDto {
    liquidationAfterMonths: number;
    // Branch the whole ServerCheck feature applies to (daily scan and network ping); null = no filter, an escape hatch only.
    serverCheckBranchId: number | null;
    serverCheckBranchName: string | null;
}

export interface UpdateAssetSettingDto {
    liquidationAfterMonths: number;
    serverCheckBranchId?: number | null;
}
