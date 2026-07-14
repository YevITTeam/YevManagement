using Asset.Application.Dtos.DeviceImports;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class DeviceImportController : BaseController
    {
        private readonly IDeviceImportService _deviceImportService;

        public DeviceImportController(IDeviceImportService deviceImportService)
        {
            _deviceImportService = deviceImportService;
        }

        // Dùng lại permission Asset.Device.Create — import Excel là 1 hình thức tạo
        // hàng loạt Device, không phải resource riêng.
        [RequirePermission("Asset.Device.Create")]
        [HttpPost("preview")]
        public async Task<ActionResult<ApiResponse<DeviceImportPreviewResultDto>>> Preview(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<DeviceImportPreviewResultDto>("Vui lòng chọn file Excel/CSV để import.");

            await using var stream = file.OpenReadStream();
            var result = await _deviceImportService.PreviewAsync(stream, file.FileName);
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        [RequirePermission("Asset.Device.Create")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<DeviceImportConfirmResultDto>>> Confirm([FromBody] ConfirmDeviceImportDto request)
        {
            var result = await _deviceImportService.ConfirmAsync(request);
            var message = result.PendingTransfers.Count > 0
                ? $"Import thành công {result.CreatedCount} thiết bị, {result.PendingTransfers.Count} thiết bị có gợi ý chuyển máy cũ (vào màn hình Chuyển máy để xác nhận)."
                : $"Import thành công {result.CreatedCount} thiết bị.";
            return Success(result, message);
        }
    }
}
