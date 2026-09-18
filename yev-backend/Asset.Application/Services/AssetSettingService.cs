using Asset.Application.Dtos.AssetSettings;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class AssetSettingService : BaseService<IAssetUnitOfWork>, IAssetSettingService
    {
        public const int DefaultLiquidationAfterMonths = 2;

        public AssetSettingService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<AssetSettingDto> GetAsync()
        {
            var setting = await GetOrCreateSettingEntityAsync();
            return await MapToDtoAsync(setting);
        }

        public async Task<AssetSettingDto> UpdateAsync(UpdateAssetSettingDto request)
        {
            var setting = await GetOrCreateSettingEntityAsync();

            if (request.ServerCheckBranchId.HasValue)
                (await _unitOfWork.Branches.GetByIdAsync(request.ServerCheckBranchId.Value)).OrThrowNotFound("Chi nhánh", request.ServerCheckBranchId.Value);

            setting.LiquidationAfterMonths = request.LiquidationAfterMonths;
            setting.ServerCheckBranchId = request.ServerCheckBranchId;

            _unitOfWork.AssetSettings.Update(setting);
            await _unitOfWork.SaveChangesAsync();

            return await MapToDtoAsync(setting);
        }

        // The table should always have exactly 1 row (seeded via migration). Auto-create the
        // default row if it is missing for some reason (e.g. manual edits directly on the DB)
        // — this prevents both the API and background service from failing due to missing config.
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

        private async Task<AssetSettingDto> MapToDtoAsync(AssetSetting setting)
        {
            string? branchName = null;
            if (setting.ServerCheckBranchId.HasValue)
            {
                var branch = await _unitOfWork.Branches.GetByIdAsync(setting.ServerCheckBranchId.Value);
                branchName = branch?.BranchName;
            }

            return new AssetSettingDto
            {
                LiquidationAfterMonths = setting.LiquidationAfterMonths,
                ServerCheckBranchId = setting.ServerCheckBranchId,
                ServerCheckBranchName = branchName
            };
        }
    }
}
