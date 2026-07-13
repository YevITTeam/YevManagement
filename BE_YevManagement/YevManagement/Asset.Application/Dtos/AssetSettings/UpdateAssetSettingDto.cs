using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.AssetSettings
{
    public class UpdateAssetSettingDto
    {
        [Range(1, 120, ErrorMessage = "Số tháng chờ thanh lý phải từ 1 đến 120.")]
        public int LiquidationAfterMonths { get; set; }
    }
}
