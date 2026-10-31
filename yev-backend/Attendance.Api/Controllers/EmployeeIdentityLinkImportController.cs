using Attendance.Application.Dtos.EmployeeIdentityLinkImports;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Creates Identity accounts and assigns signatures without email confirmation, so its permission is Admin-only.
    public class EmployeeIdentityLinkImportController : BaseController
    {
        private readonly IEmployeeIdentityLinkImportService _employeeIdentityLinkImportService;

        public EmployeeIdentityLinkImportController(IEmployeeIdentityLinkImportService employeeIdentityLinkImportService)
        {
            _employeeIdentityLinkImportService = employeeIdentityLinkImportService;
        }

        [RequirePermission("Identity.User.BulkImport")]
        [HttpPost("preview")]
        public async Task<ActionResult<ApiResponse<EmployeeIdentityLinkImportPreviewResultDto>>> Preview(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<EmployeeIdentityLinkImportPreviewResultDto>("Vui lòng chọn file Excel để import.");

            await using var stream = file.OpenReadStream();
            var result = await _employeeIdentityLinkImportService.PreviewAsync(stream);
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        // Takes the whole file again (not previewed rows) because rows may embed signature images.
        [RequirePermission("Identity.User.BulkImport")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<EmployeeIdentityLinkImportConfirmResultDto>>> Confirm(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<EmployeeIdentityLinkImportConfirmResultDto>("Vui lòng chọn file Excel để import.");

            await using var stream = file.OpenReadStream();
            var result = await _employeeIdentityLinkImportService.ConfirmAsync(stream);
            var message = $"Đã liên kết {result.SuccessCount} nhân viên ({result.CreatedIdentityUserCount} tài khoản mới, " +
                $"{result.SignatureSetCount} chữ ký)" + (result.SkippedCount > 0 ? $", bỏ qua {result.SkippedCount} dòng." : ".");
            return Success(result, message);
        }

        [RequirePermission("Identity.User.BulkImport")]
        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] EmployeeExportFilterDto filter)
        {
            var (content, fileName) = await _employeeIdentityLinkImportService.ExportAsync(filter, CurrentUserName, User.IsInRole("Admin"));
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Identity.User.BulkImport")]
        [HttpGet("template")]
        public async Task<IActionResult> DownloadTemplate()
        {
            var (content, fileName) = await _employeeIdentityLinkImportService.GenerateTemplateAsync();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
