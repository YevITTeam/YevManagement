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
            var result = await _productionEmployeeImportService.PreviewAsync(stream);
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        [RequirePermission("Attendance.ProductionEmployee.Import")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<ProductionEmployeeImportConfirmResultDto>>> Confirm([FromBody] ConfirmProductionEmployeeImportDto request)
        {
            var result = await _productionEmployeeImportService.ConfirmAsync(request);
            return Success(result, "Import nhân sự dưới chuyền thành công.");
        }

        // Tách quyền riêng (2026-08-27, theo yêu cầu người dùng) — đụng lũy kế OT ảnh hưởng lương, chỉ
        // người có trách nhiệm mới được bấm, khác quyền import cấu trúc Block/Team/CongDoan thường.
        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpPost("apply-accumulation")]
        public async Task<ActionResult<ApiResponse<ProductionEmployeeAccumulationResultDto>>> ApplyAccumulation([FromBody] ApplyProductionEmployeeAccumulationDto request)
        {
            var result = await _productionEmployeeImportService.ApplyAccumulationAsync(request);
            return Success(result, $"Đã điều chỉnh lũy kế cho {result.AdjustedCount} nhân viên.");
        }

        // File mẫu tải xuống (2026-08-27) — trả file .xlsx trực tiếp, KHÔNG bọc ApiResponse<T>.
        [RequirePermission("Attendance.ProductionEmployee.Import")]
        [HttpGet("template")]
        public IActionResult DownloadTemplate()
        {
            var (content, fileName) = _productionEmployeeImportService.GenerateTemplate();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
