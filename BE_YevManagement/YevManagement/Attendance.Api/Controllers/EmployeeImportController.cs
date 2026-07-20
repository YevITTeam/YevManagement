using Attendance.Application.Dtos.EmployeeImports;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Import hàng loạt Employee (upsert theo Code — tạo mới nếu chưa có, cập nhật lại nếu đã tồn
    // tại) kèm tự tạo Department/Group nếu mã chưa có, từ file Excel nhân sự. Dùng lại permission
    // của resource chính (Attendance.Employee.Create) thay vì tạo permission "import" riêng — cùng
    // pattern DeviceImportController ở module Asset (2026-07-16, gắn permission theo yêu cầu).
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
