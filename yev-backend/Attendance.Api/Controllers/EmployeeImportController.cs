using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Dtos.ProductionEmployeeImports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Upsert by Code, auto-creating missing Department/Group; reuses Employee.Create instead of a separate import permission.
    public class EmployeeImportController : BaseController
    {
        private const string AdminRole = "Admin";
        private readonly IEmployeeImportService _employeeImportService;

        public EmployeeImportController(IEmployeeImportService employeeImportService)
        {
            _employeeImportService = employeeImportService;
        }

        [RequirePermission("Attendance.Employee.Create")]
        [HttpPost("preview")]
        public async Task<ActionResult<ApiResponse<EmployeeImportPreviewResultDto>>> Preview(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<EmployeeImportPreviewResultDto>("Vui lòng chọn file Excel để import.");

            await using var stream = file.OpenReadStream();
            var result = await _employeeImportService.PreviewAsync(stream, CurrentUserName, User.IsInRole(AdminRole));
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        [RequirePermission("Attendance.Employee.Create")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<EmployeeImportConfirmResultDto>>> Confirm([FromBody] ConfirmEmployeeImportDto request)
        {
            var result = await _employeeImportService.ConfirmAsync(request, CurrentUserName, User.IsInRole(AdminRole));
            var message = $"Import thành công: {result.CreatedEmployeeCount} nhân viên mới, {result.UpdatedEmployeeCount} nhân viên cập nhật " +
                $"({result.CreatedDepartmentCount} phòng ban mới, {result.CreatedGroupCount} nhóm mới)" +
                (result.SkippedCount > 0 ? $", bỏ qua {result.SkippedCount} dòng lỗi." : ".");
            return Success(result, message);
        }

        // Narrower than Employee.Update; auto-granted to Department coordinators, with per-row scope checks in the service.
        [RequirePermission("Attendance.Employee.UpdateOtLimit")]
        [HttpPost("ot-hour-limits")]
        public async Task<ActionResult<ApiResponse<EmployeeOtHourLimitImportResultDto>>> ImportOtHourLimits(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return Fail<EmployeeOtHourLimitImportResultDto>("Vui lòng chọn file Excel để import.");

            await using var stream = file.OpenReadStream();
            var result = await _employeeImportService.ImportOtHourLimitsAsync(stream, CurrentUserName, User.IsInRole(AdminRole));
            var message = $"Đã cập nhật giới hạn OT cho {result.UpdatedCount} nhân viên" +
                (result.SkippedCount > 0 ? $", bỏ qua {result.SkippedCount} dòng." : ".");
            return Success(result, message);
        }

        // Reuses EmployeeAccumulation.Import, already auto-granted to every Department coordinator.
        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpPost("monthly-accumulation")]
        public async Task<ActionResult<ApiResponse<ProductionEmployeeAccumulationResultDto>>> ImportMonthlyAccumulation(
            IFormFile file, [FromQuery] int year, [FromQuery] int month)
        {
            if (file == null || file.Length == 0)
                return Fail<ProductionEmployeeAccumulationResultDto>("Vui lòng chọn file Excel để import.");
            if (month < 1 || month > 12)
                return Fail<ProductionEmployeeAccumulationResultDto>("Tháng không hợp lệ.");

            await using var stream = file.OpenReadStream();
            var result = await _employeeImportService.ImportMonthlyAccumulationAsync(stream, year, month, CurrentUserName, User.IsInRole(AdminRole));
            var messageParts = new List<string>();
            if (result.AdjustedCount > 0) messageParts.Add($"tháng cho {result.AdjustedCount} nhân viên");
            if (result.AdjustedYearCount > 0) messageParts.Add($"năm cho {result.AdjustedYearCount} nhân viên");
            var detail = messageParts.Count > 0 ? string.Join(", ", messageParts) : "0 nhân viên";
            var message = $"Đã điều chỉnh lũy kế {detail}" +
                (result.SkippedCount > 0 ? $", bỏ qua {result.SkippedCount} dòng." : ".");
            return Success(result, message);
        }

        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpPost("yearly-accumulation")]
        public async Task<ActionResult<ApiResponse<ProductionEmployeeAccumulationResultDto>>> ImportYearlyAccumulation(
            IFormFile file, [FromQuery] int year)
        {
            if (file == null || file.Length == 0)
                return Fail<ProductionEmployeeAccumulationResultDto>("Vui lòng chọn file Excel để import.");
            if (year < 2000 || year > 2100)
                return Fail<ProductionEmployeeAccumulationResultDto>("Năm không hợp lệ.");

            await using var stream = file.OpenReadStream();
            var result = await _employeeImportService.ImportYearlyAccumulationAsync(stream, year, CurrentUserName, User.IsInRole(AdminRole));
            var message = $"Đã điều chỉnh lũy kế năm {year} cho {result.AdjustedCount} nhân viên" +
                (result.SkippedCount > 0 ? $", bỏ qua {result.SkippedCount} dòng." : ".");
            return Success(result, message);
        }

        // Returns the .xlsx directly, not ApiResponse<T>.
        [RequirePermission("Attendance.Employee.Create")]
        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] EmployeeExportFilterDto filter)
        {
            var (content, fileName) = await _employeeImportService.ExportEmployeesAsync(filter, CurrentUserName, User.IsInRole(AdminRole));
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.Employee.UpdateOtLimit")]
        [HttpGet("ot-hour-limits/export")]
        public async Task<IActionResult> ExportOtHourLimits([FromQuery] EmployeeExportFilterDto filter)
        {
            var (content, fileName) = await _employeeImportService.ExportOtHourLimitsAsync(filter, CurrentUserName, User.IsInRole(AdminRole));
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpGet("monthly-accumulation/export")]
        public async Task<IActionResult> ExportMonthlyAccumulation([FromQuery] EmployeeExportFilterDto filter, [FromQuery] int year, [FromQuery] int month)
        {
            if (month < 1 || month > 12)
                return BadRequest("Tháng không hợp lệ.");
            var (content, fileName) = await _employeeImportService.ExportMonthlyAccumulationAsync(filter, year, month, CurrentUserName, User.IsInRole(AdminRole));
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpGet("yearly-accumulation/export")]
        public async Task<IActionResult> ExportYearlyAccumulation([FromQuery] EmployeeExportFilterDto filter, [FromQuery] int year)
        {
            if (year < 2000 || year > 2100)
                return BadRequest("Năm không hợp lệ.");
            var (content, fileName) = await _employeeImportService.ExportYearlyAccumulationAsync(filter, year, CurrentUserName, User.IsInRole(AdminRole));
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.Employee.Create")]
        [HttpGet("template")]
        public async Task<IActionResult> DownloadTemplate()
        {
            var (content, fileName) = await _employeeImportService.GenerateTemplateAsync();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.Employee.UpdateOtLimit")]
        [HttpGet("ot-hour-limits/template")]
        public IActionResult DownloadOtHourLimitTemplate()
        {
            var (content, fileName) = _employeeImportService.GenerateOtHourLimitTemplate();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpGet("yearly-accumulation/template")]
        public IActionResult DownloadYearlyAccumulationTemplate()
        {
            var (content, fileName) = _employeeImportService.GenerateYearlyAccumulationTemplate();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [RequirePermission("Attendance.EmployeeAccumulation.Import")]
        [HttpGet("monthly-accumulation/template")]
        public IActionResult DownloadMonthlyAccumulationTemplate()
        {
            var (content, fileName) = _employeeImportService.GenerateMonthlyAccumulationTemplate();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
