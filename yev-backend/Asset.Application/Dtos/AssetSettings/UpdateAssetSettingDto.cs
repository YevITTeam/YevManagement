using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.AssetSettings
{
    public class UpdateAssetSettingDto
    {
        [Range(1, 120, ErrorMessage = "Số tháng giữa 2 lần tự động xóa thiết bị đã thanh lý phải từ 1 đến 120.")]
        public int LiquidationAfterMonths { get; set; }
    }
}
