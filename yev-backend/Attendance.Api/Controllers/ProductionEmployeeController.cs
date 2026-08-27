using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class ProductionEmployeeController : BaseController
    {
        private readonly IProductionEmployeeService _productionEmployeeService;

        public ProductionEmployeeController(IProductionEmployeeService productionEmployeeService)
        {
            _productionEmployeeService = productionEmployeeService;
        }

        // Dùng chung quyền tạo đơn OT hiện có — không tạo permission riêng (2026-08-24, theo yêu cầu
        // người dùng — xem docs/docs-be/attendance-module.md §Đơn theo chuyền).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("search")]
        public async Task<ActionResult<ApiResponse<List<ProductionEmployeeSearchItemDto>>>> Search(
            [FromQuery] int? productionLineId, [FromQuery] int? teamId, [FromQuery] int? shiftTeamId,
            [FromQuery] string? congDoan, [FromQuery] string? keyword, [FromQuery] DateOnly? date = null)
        {
            var result = await _productionEmployeeService.SearchAsync(productionLineId, teamId, shiftTeamId, congDoan, keyword, date);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("line-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetLineOptions([FromQuery] int? teamId)
        {
            var result = await _productionEmployeeService.GetLineOptionsAsync(teamId);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("team-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetTeamOptions()
        {
            var result = await _productionEmployeeService.GetTeamOptionsAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("shift-team-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetShiftTeamOptions(
            [FromQuery] int? productionLineId, [FromQuery] int? teamId)
        {
            var result = await _productionEmployeeService.GetShiftTeamOptionsAsync(productionLineId, teamId);
            return Success(result);
        }

        // Màn "Nhân viên dưới chuyền" — dùng chung quyền xem Nhân viên (2026-08-27, chỉ là 1 view khác
        // của cùng dữ liệu nhân sự, không phải năng lực mới cần permission riêng).
        [RequirePermission("Attendance.Employee.View")]
        [HttpGet("page-nation")]
        public async Task<ActionResult<ApiResponse<PagedResponse<ProductionEmployeeListItemDto>>>> GetPaged(
            [FromQuery] int pageIndex, [FromQuery] int pageSize, [FromQuery] string? keyword,
            [FromQuery] int? productionLineId, [FromQuery] int? teamId, [FromQuery] int? shiftTeamId, [FromQuery] int? departmentId)
        {
            var result = await _productionEmployeeService.GetPagedAsync(
                pageIndex, pageSize, keyword, productionLineId, teamId, shiftTeamId, departmentId);
            return Success(result);
        }
    }
}
