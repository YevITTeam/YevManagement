namespace Asset.Domain.Entities;

// System configuration for the Asset module — always exactly 1 row (Id=1), edited via API instead
// of appsettings.json so the Admin can change it immediately without redeploying (see docs/asset-module.md).
public partial class AssetSetting
{
    public int Id { get; set; }

    // Number of months counted from ExpirationDate to automatically move a Device from
    // "Pending Liquidation" (PendingLiquidation) to "Liquidated" (Liquidated). Default 2.
    public int LiquidationAfterMonths { get; set; }
}
