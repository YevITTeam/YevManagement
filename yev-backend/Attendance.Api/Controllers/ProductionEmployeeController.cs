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

        // Reuses OT-create permissions; CreateProduction included so production-only Line Leaders can search employees
        // (a 403 here surfaces in the FE only as "no matches").
        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpGet("search")]
        public async Task<ActionResult<ApiResponse<List<ProductionEmployeeSearchItemDto>>>> Search(
            [FromQuery] int? productionLineId, [FromQuery] int? teamId, [FromQuery] int? shiftTeamId,
            [FromQuery] string? congDoan, [FromQuery] string? keyword, [FromQuery] DateOnly? date = null)
        {
            var result = await _productionEmployeeService.SearchAsync(productionLineId, teamId, shiftTeamId, congDoan, keyword, date);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction", "Attendance.Employee.View", "Attendance.ProductionEmployee.View")]
        [HttpGet("line-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetLineOptions([FromQuery] int? teamId)
        {
            var result = await _productionEmployeeService.GetLineOptionsAsync(teamId);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction", "Attendance.Employee.View", "Attendance.ProductionEmployee.View")]
        [HttpGet("team-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetTeamOptions()
        {
            var result = await _productionEmployeeService.GetTeamOptionsAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction", "Attendance.Employee.View", "Attendance.ProductionEmployee.View")]
        [HttpGet("shift-team-options")]
        public async Task<ActionResult<ApiResponse<List<ProductionOptionDto>>>> GetShiftTeamOptions(
            [FromQuery] int? productionLineId, [FromQuery] int? teamId)
        {
            var result = await _productionEmployeeService.GetShiftTeamOptionsAsync(productionLineId, teamId);
            return Success(result);
        }

        [RequirePermission("Attendance.Employee.View", "Attendance.ProductionEmployee.View")]
        [HttpGet("cong-doan-options")]
        public async Task<ActionResult<ApiResponse<List<string>>>> GetCongDoanOptions()
        {
            var result = await _productionEmployeeService.GetCongDoanOptionsAsync();
            return Success(result);
        }
    }
}
