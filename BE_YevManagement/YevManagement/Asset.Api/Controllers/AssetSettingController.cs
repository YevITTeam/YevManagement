using Asset.Application.Dtos.AssetSettings;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class AssetSettingController : BaseController
    {
        private readonly IAssetSettingService _assetSettingService;

        public AssetSettingController(IAssetSettingService assetSettingService)
        {
            _assetSettingService = assetSettingService;
        }

        [RequirePermission("Asset.Setting.View")]
        [HttpGet]
        public async Task<ActionResult<ApiResponse<AssetSettingDto>>> Get()
        {
            var result = await _assetSettingService.GetAsync();
            return Success(result);
        }

        [RequirePermission("Asset.Setting.Update")]
        [HttpPut]
        public async Task<ActionResult<ApiResponse<AssetSettingDto>>> Update([FromBody] UpdateAssetSettingDto request)
        {
            var result = await _assetSettingService.UpdateAsync(request);
            return Success(result, "Cập nhật cấu hình thành công.");
        }
    }
}
