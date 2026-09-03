using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Dtos.ProductionEmployeeImports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Bulk import Employees (upsert by Code — create new if not existing, update if already
    // exists) with automatic creation of Department/Group if the code doesn't exist yet, from an
    // HR Excel file. Reuses the permission of the main resource (Attendance.Employee.Create)
    // instead of creating a separate "import" permission — same pattern as DeviceImportController
    // in the Asset module (2026-07-16, permission attached per requirement).
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
            var result = await _employeeImportService.PreviewAsync(stream);
            return Success(result, "Đọc file thành công, vui lòng xem lại bản xem trước bên dưới.");
        }

        [RequirePermission("Attendance.Employee.Create")]
        [HttpPost("confirm")]
        public async Task<ActionResult<ApiResponse<EmployeeImportConfirmResultDto>>> Confirm([FromBody] ConfirmEmployeeImportDto request)
        {
            var result = await _employeeImportService.ConfirmAsync(request);
            var message = $"Import thành công: {result.CreatedEmployeeCount} nhân viên mới, {result.UpdatedEmployeeCount} nhân viên cập nhật " +
                $"({result.CreatedDepartmentCount} phòng ban mới, {result.CreatedGroupCount} nhóm mới)" +
                (result.SkippedCount > 0 ? $", bỏ qua {result.SkippedCount} dòng lỗi." : ".");
            return Success(result, message);
        }

        // Mục 5 (2026-08-27) — import hàng loạt giới hạn OT tháng/năm riêng từng nhân viên. Permission
        // RIÊNG hẹp hơn Attendance.Employee.Update (2026-08-29 — đổi từ Employee.Update sang
        // Employee.UpdateOtLimit, tự cấp cho Người phụ trách Bộ phận, scope theo dòng qua
        // EmployeeImportService.ImportOtHourLimitsAsync) — xem docs/docs-be/attendance-module.md §Phân
        // quyền theo Phòng ban.
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

        // Import lũy kế OT theo THÁNG cho MỌI Phòng ban (2026-09-03) — dùng lại NGUYÊN permission
        // Attendance.EmployeeAccumulation.Import đã có sẵn (đã tự động cấp cho Người phụ trách BẤT KỲ
        // Phòng ban nào từ trước, không cần migration/permission mới) — xem
        // docs/docs-be/attendance-module.md §Phân quyền theo Phòng ban.
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
            var message = $"Đã điều chỉnh lũy kế cho {result.AdjustedCount} nhân viên" +
                (result.SkippedCount > 0 ? $", bỏ qua {result.SkippedCount} dòng." : ".");
            return Success(result, message);
        }

        // File mẫu tải xuống (2026-08-27) — trả file .xlsx trực tiếp, KHÔNG bọc ApiResponse<T>, cùng
        // pattern ProductionEmployeeExportController.Export.
        [RequirePermission("Attendance.Employee.Create")]
        [HttpGet("template")]
        public IActionResult DownloadTemplate()
        {
            var (content, fileName) = _employeeImportService.GenerateTemplate();
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
        [HttpGet("monthly-accumulation/template")]
        public IActionResult DownloadMonthlyAccumulationTemplate()
        {
            var (content, fileName) = _employeeImportService.GenerateMonthlyAccumulationTemplate();
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
