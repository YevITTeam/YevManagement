using Asset.Application.Dtos.DeviceLiquidationImports;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    // Bulk-liquidate devices by importing an Excel/CSV of device codes (2026-07-23). Two steps
    // (preview/confirm) like the other imports. Reuses Asset.Device.Update — liquidation is a status
    // change on existing devices, not a new resource.
    public class DeviceLiquidationImportController : BaseController
    {
        private readonly IDeviceLiquidationImportService _deviceLiquidationImportService;

        public DeviceLiquidationImportController(IDeviceLiquidationImportService deviceLiquidationImportService)
        {
            _deviceLiquidationImportService = deviceLiquidationImportService;
        }

        [RequirePermission("Asset.Device.Update")]
        [HttpPost("preview")]
        public async Task<ActionResult<ApiResponse<DeviceLiquidationImportPreviewResultDto>>> Preview(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<DeviceLiquidationImportPreviewResultDto>("Vui lòng chọn file Excel/CSV để import.");

            await using var stream = file.OpenReadStream();
            var result = await _deviceLiquidationImportService.PreviewAsync(stream, file.FileName);
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        [RequirePermission("Asset.Device.Update")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<DeviceLiquidationImportConfirmResultDto>>> Confirm([FromBody] ConfirmDeviceLiquidationImportDto request)
        {
            var result = await _deviceLiquidationImportService.ConfirmAsync(request);
            return Success(result, result.SkippedCount == 0
                ? $"Đã thanh lý {result.LiquidatedCount} thiết bị."
                : $"Đã thanh lý {result.LiquidatedCount} thiết bị, bỏ qua {result.SkippedCount} dòng.");
        }
    }
}
