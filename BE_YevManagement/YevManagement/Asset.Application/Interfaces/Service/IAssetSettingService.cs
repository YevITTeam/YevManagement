using Asset.Application.Dtos.AssetSettings;

namespace Asset.Application.Interfaces.Service
{
    public interface IAssetSettingService
    {
        Task<AssetSettingDto> GetAsync();
        Task<AssetSettingDto> UpdateAsync(UpdateAssetSettingDto request);
    }
}
