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
}
