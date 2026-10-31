using Attendance.Application.Dtos.ProductionEmployeeImports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class ProductionEmployeeImportController : BaseController
    {
        private const string AdminRole = "Admin";
        private readonly IProductionEmployeeImportService _productionEmployeeImportService;

        public ProductionEmployeeImportController(IProductionEmployeeImportService productionEmployeeImportService)
        {
            _productionEmployeeImportService = productionEmployeeImportService;
        }

        [RequirePermission("Attendance.ProductionEmployee.Import")]
        [HttpPost("preview")]
        public async Task<ActionResult<ApiResponse<ProductionEmployeeImportPreviewResultDto>>> Preview(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<ProductionEmployeeImportPreviewResultDto>("Vui lòng chọn file Excel để import.");

            await using var stream = file.OpenReadStream();
            var result = await _productionEmployeeImportService.PreviewAsync(stream, CurrentUserName, User.IsInRole(AdminRole));
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        [RequirePermission("Attendance.ProductionEmployee.Import")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<ProductionEmployeeImportConfirmResultDto>>> Confirm([FromBody] ConfirmProductionEmployeeImportDto request)
        {
            var result = await _productionEmployeeImportService.ConfirmAsync(request, CurrentUserName, User.IsInRole(AdminRole));
            return Success(result, "Import nhân sự dưới chuyền thành công.");
        }

        // Separate permission: accumulated OT affects payroll.
        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpPost("apply-accumulation")]
        public async Task<ActionResult<ApiResponse<ProductionEmployeeAccumulationResultDto>>> ApplyAccumulation([FromBody] ApplyProductionEmployeeAccumulationDto request)
        {
            var result = await _productionEmployeeImportService.ApplyAccumulationAsync(request, CurrentUserName, User.IsInRole(AdminRole));
            return Success(result, $"Đã điều chỉnh lũy kế cho {result.AdjustedCount} nhân viên.");
        }

        // Returns the .xlsx directly, not ApiResponse<T>.
        [RequirePermission("Attendance.ProductionEmployee.Import")]
        [HttpGet("template")]
        public IActionResult DownloadTemplate()
        {
            var (content, fileName) = _productionEmployeeImportService.GenerateTemplate();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
