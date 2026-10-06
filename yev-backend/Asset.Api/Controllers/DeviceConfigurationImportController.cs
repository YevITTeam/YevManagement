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

        // The same reconciliation as rows for the on-screen report (the FE then offers the Excel download).
        [RequirePermission("Asset.DeviceConfiguration.Update")]
        [HttpPost("missing-devices")]
        public async Task<ActionResult<ApiResponse<List<DeviceMissingInTaniumDto>>>> GetMissingDevices(IFormFile file, [FromForm] string? prefixes)
        {
            if (file == null || file.Length == 0)
                return Fail<List<DeviceMissingInTaniumDto>>("Vui lòng chọn file Excel/CSV để đối chiếu.");

            await using var stream = file.OpenReadStream();
            var missing = await _deviceConfigurationImportService.GetMissingDevicesAsync(stream, file.FileName, ParsePrefixes(prefixes));
            return Success(missing, $"Có {missing.Count} thiết bị đang sử dụng nhưng không có trong file Tanium.");
        }

        // Đối chiếu Device Status=InUse trong hệ thống với danh sách máy có mặt trong chính file
        // Tanium vừa chọn — trả về file .xlsx để tải xuống, KHÔNG phải ApiResponse<T> như 2 action
        // trên (giống lý do AiChatController.Stream không dùng Success()/Fail(): body ở đây là 1
        // file binary, không phải 1 envelope JSON). Vẫn dùng ApiResponse<object> cho nhánh lỗi vì
        // lỗi đó xảy ra TRƯỚC khi bắt đầu ghi file, không có gì ngăn trả JSON bình thường.
        [RequirePermission("Asset.DeviceConfiguration.Update")]
        [HttpPost("missing-devices-report")]
        public async Task<IActionResult> GetMissingDevicesReport(IFormFile file, [FromForm] string? prefixes)
        {
            if (file == null || file.Length == 0)
                return BadRequest(ApiResponse<object>.Failure("Vui lòng chọn file Excel/CSV để đối chiếu."));

            await using var stream = file.OpenReadStream();
            var report = await _deviceConfigurationImportService.BuildMissingDevicesReportAsync(stream, file.FileName, ParsePrefixes(prefixes));

            // Header riêng cho số lượng — FE đọc để hiện toast tóm tắt mà không phải mở file ra đếm.
            // Phải khai báo trong CORS "AllowNextJs".WithExposedHeaders(...) (Program.cs) thì trình
            // duyệt mới cho JS đọc được header tùy biến này ở request khác origin.
            Response.Headers["X-Missing-Device-Count"] = report.MissingCount.ToString();

            return File(
                report.FileContent,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                report.FileName);
        }

        // "prefixes" is a comma separated string (e.g. "YDC,YDF,YLC") typed by the user; empty = no prefix filter.
        private static string[] ParsePrefixes(string? prefixes) =>
            (prefixes ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}
