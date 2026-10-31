using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;

namespace Attendance.Api.Controllers
{
    public class ProductionEmployeeExportController : BaseController
    {
        private const string AdminRole = "Admin";

        private readonly IProductionEmployeeExportService _productionEmployeeExportService;

        public ProductionEmployeeExportController(IProductionEmployeeExportService productionEmployeeExportService)
        {
            _productionEmployeeExportService = productionEmployeeExportService;
        }

        // Returns the .xlsx directly, not ApiResponse<T>.
        [RequirePermission("Attendance.ProductionEmployee.Export")]
        [HttpGet("export")]
        public async Task<IActionResult> Export()
        {
            var (content, fileName) = await _productionEmployeeExportService.ExportAsync(CurrentUserName, User.IsInRole(AdminRole));
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
