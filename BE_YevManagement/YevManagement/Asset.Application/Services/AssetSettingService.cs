using Asset.Application.Dtos.AssetSettings;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Services;

namespace Asset.Application.Services
{
    public class AssetSettingService : BaseService<IAssetUnitOfWork>, IAssetSettingService
    {
        public const int DefaultLiquidationAfterMonths = 2;

        public AssetSettingService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<AssetSettingDto> GetAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return new AssetSettingDto { LiquidationAfterMonths = setting.LiquidationAfterMonths };
        }

        public async Task<AssetSettingDto> UpdateAsync(UpdateAssetSettingDto request)
        {
            var setting = await GetOrCreateSettingEntityAsync();
            setting.LiquidationAfterMonths = request.LiquidationAfterMonths;

            _unitOfWork.AssetSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();

            return new AssetSettingDto { LiquidationAfterMonths = setting.LiquidationAfterMonths };
        }

        // Bảng chỉ có đúng 1 dòng (seed sẵn qua migration). Tự tạo dòng mặc định nếu vì lý
        // do gì đó bị thiếu (VD chỉnh tay trực tiếp trên DB) — tránh cả API lẫn background
        // service rớt lỗi vì thiếu cấu hình.
        private async Task<AssetSetting> GetOrCreateSettingEntityAsync()
        {
            var settings = await _unitOfWork.AssetSettings.GetAllAsync();
            var setting = settings.FirstOrDefault();
            if (setting != null) return setting;

            setting = new AssetSetting { LiquidationAfterMonths = DefaultLiquidationAfterMonths };
            await _unitOfWork.AssetSettings.AddAsync(setting);
            await _unitOfWork.SaveChangesAsync();
            return setting;
        }
    }
}
