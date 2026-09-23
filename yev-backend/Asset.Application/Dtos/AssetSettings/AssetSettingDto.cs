namespace Asset.Application.Dtos.AssetSettings
{
    public class AssetSettingDto
    {
        public int LiquidationAfterMonths { get; set; }
        public int? ServerCheckBranchId { get; set; }
        public string? ServerCheckBranchName { get; set; }
    }
}
