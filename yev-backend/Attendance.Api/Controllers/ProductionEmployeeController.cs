using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class ProductionEmployeeController : BaseController
    {
        private const string AdminRole = "Admin";

        private readonly IProductionEmployeeService _productionEmployeeService;

        public ProductionEmployeeController(IProductionEmployeeService productionEmployeeService)
        {
            _productionEmployeeService = productionEmployeeService;
        }

        // Dùng chung quyền tạo đơn OT hiện có — không tạo permission riêng (2026-08-24, theo yêu cầu
        // người dùng — xem docs/docs-be/attendance-module.md §Cây chức vụ & Cây duyệt). Create/CreateProduction
        // là 2 quyền TÁCH RỜI (Giai đoạn 14/17) — 4 endpoint dưới đây CHỈ phục vụ tìm/lọc nhân sự dưới
        // chuyền để tạo đơn "Theo chuyền", nên OR cả CreateProduction vào, không thì Line Leader chỉ có
        // CreateProduction (không có Create) bị 403 ngay từ bước tìm nhân viên — 403 rơi vào .catch() ở
        // FE nên không có lỗi hiện rõ, chỉ thấy triệu chứng "Không tìm thấy ai khớp bộ lọc" (2026-09-28,
        // sửa cùng đợt với OtFormController.Create/Update/check-overlap).
        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpGet("search")]
        public async Task<ActionResult<ApiResponse<List<ProductionEmployeeSearchItemDto>>>> Search(
            [FromQuery] int? productionLineId, [FromQuery] int? teamId, [FromQuery] int? shiftTeamId,
            [FromQuery] string? congDoan, [FromQuery] string? keyword, [FromQuery] DateOnly? date = null)
        {
            var result = await _productionEmployeeService.SearchAsync(productionLineId, teamId, shiftTeamId, congDoan, keyword, date);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpGet("line-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetLineOptions([FromQuery] int? teamId)
        {
            var result = await _productionEmployeeService.GetLineOptionsAsync(teamId);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpGet("team-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetTeamOptions()
        {
            var result = await _productionEmployeeService.GetTeamOptionsAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpGet("shift-team-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetShiftTeamOptions(
            [FromQuery] int? productionLineId, [FromQuery] int? teamId)
        {
            var result = await _productionEmployeeService.GetShiftTeamOptionsAsync(productionLineId, teamId);
            return Success(result);
        }

        // Màn "Nhân viên dưới chuyền" — quyền xem RIÊNG (2026-09-26): trước đây dùng chung
        // Attendance.Employee.View nên mọi Người phụ trách/Trưởng nhóm đều vào xem được.
        [RequirePermission("Attendance.ProductionEmployee.View")]
        [HttpGet("page-nation")]
        public async Task<ActionResult<ApiResponse<PagedResponse<ProductionEmployeeListItemDto>>>> GetPaged(
            [FromQuery] int pageIndex, [FromQuery] int pageSize, [FromQuery] string? keyword,
            [FromQuery] int? productionLineId, [FromQuery] int? teamId, [FromQuery] int? shiftTeamId, [FromQuery] int? departmentId)
        {
            var result = await _productionEmployeeService.GetPagedAsync(
                CurrentUserName, User.IsInRole(AdminRole), pageIndex, pageSize, keyword, productionLineId, teamId, shiftTeamId, departmentId);
            return Success(result);
        }

        // Sửa tay Line/Team/Nhóm ca/Trưởng nhóm giữa 2 đợt import (2026-09-04) — permission RIÊNG với
        // Import (khác population: Import là nạp cả file, Update là sửa nhanh 1 người ngay trên UI).
        [RequirePermission("Attendance.ProductionEmployee.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateProductionEmployeeDto request)
        {
            await _productionEmployeeService.UpdateAsync(id, request, CurrentUserName, User.IsInRole(AdminRole));
            return Success(true, "Cập nhật nhân viên dưới chuyền thành công.");
        }
    }
}
