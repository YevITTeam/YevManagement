using Asset.Application.Dtos.DeviceConfigurationImports;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class DeviceConfigurationImportController : BaseController
    {
        private readonly IDeviceConfigurationImportService _deviceConfigurationImportService;

        public DeviceConfigurationImportController(IDeviceConfigurationImportService deviceConfigurationImportService)
        {
            _deviceConfigurationImportService = deviceConfigurationImportService;
        }

        // Reuses the Asset.DeviceConfiguration.Update permission — import only updates the
        // configuration of existing devices, it does not create new Devices.
        [RequirePermission("Asset.DeviceConfiguration.Update")]
        [HttpPost("preview")]
        public async Task<ActionResult<ApiResponse<DeviceConfigurationImportPreviewResultDto>>> Preview(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<DeviceConfigurationImportPreviewResultDto>("Vui lòng chọn file Excel/CSV để import.");

            await using var stream = file.OpenReadStream();
            var result = await _deviceConfigurationImportService.PreviewAsync(stream, file.FileName);
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        [RequirePermission("Asset.DeviceConfiguration.Update")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<DeviceConfigurationImportConfirmResultDto>>> Confirm([FromBody] ConfirmDeviceConfigurationImportDto request)
        {
            var result = await _deviceConfigurationImportService.ConfirmAsync(request);
            return Success(result, $"Import cấu hình thành công {result.UpdatedDeviceIds.Count} thiết bị.");
        }
    }
}
