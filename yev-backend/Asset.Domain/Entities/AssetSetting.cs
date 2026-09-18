namespace Asset.Domain.Entities;

// System configuration for the Asset module — always exactly 1 row (Id=1), edited via API instead
// of appsettings.json so the Admin can change it immediately without redeploying (see docs/asset-module.md).
public partial class AssetSetting
{
    public int Id { get; set; }

    // Repurposed 2026-08-22 (was: months from ExpirationDate before auto-transitioning
    // PendingLiquidation -> Liquidated, a feature since dropped). Now: how many months apart
    // DeviceLiquidationBackgroundService's auto soft-delete sweep (for Devices already Liquidated)
    // should run — see LastAutoDeleteRunAt. Default 2.
    public int LiquidationAfterMonths { get; set; }

    // Bookkeeping only, not exposed via AssetSettingDto/API — timestamp of the last time
    // DeviceLiquidationBackgroundService actually ran its sweep. Null means it has never run yet
    // (treated as due immediately). Updated by the background service itself, not by the Admin.
    public DateTime? LastAutoDeleteRunAt { get; set; }

    // Added 2026-09-17, renamed 2026-09-17 (was NetworkCheckBranchId, ping-only): which single Branch's
    // devices the whole ServerCheck feature applies to — both the daily scan snapshot (StartSessionAsync)
    // and the "Kiểm tra network" ping button (PingNetworkAsync), asset-module.md §1.19/§1.20. The feature
    // models exactly 1 physical server room; without this filter StartSessionAsync snapshotted Server/
    // Network/UPS devices from EVERY branch (~123 items), not just the ~20 physically in the room being
    // checked. Null = no branch filter (kept as an escape hatch, not the intended steady-state config).
    public int? ServerCheckBranchId { get; set; }

    public virtual Branch? ServerCheckBranch { get; set; }
}
