using Attendance.Application.Dtos.EmployeeImports;
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
    }
}
