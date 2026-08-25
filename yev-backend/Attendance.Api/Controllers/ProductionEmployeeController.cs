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
            [FromQuery] string? congDoan, [FromQuery] string? keyword)
        {
            var result = await _productionEmployeeService.SearchAsync(productionLineId, teamId, shiftTeamId, congDoan, keyword);
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
    }
}
