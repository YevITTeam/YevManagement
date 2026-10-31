namespace Asset.Domain.Entities;

// Always exactly 1 row (Id=1), edited via API so Admin changes apply without redeploying.
public partial class AssetSetting
{
    public int Id { get; set; }

    // Months between DeviceLiquidationBackgroundService's auto soft-delete sweeps of Liquidated devices.
    public int LiquidationAfterMonths { get; set; }

    // Not exposed via API; written by the background service. Null = never run (due immediately).
    public DateTime? LastAutoDeleteRunAt { get; set; }

    // The single branch (server room) the ServerCheck feature applies to; without it every branch's devices
    // get snapshotted. Null = no branch filter (escape hatch only).
    public int? ServerCheckBranchId { get; set; }

    public virtual Branch? ServerCheckBranch { get; set; }
}
