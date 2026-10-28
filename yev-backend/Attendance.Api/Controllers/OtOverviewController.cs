using Attendance.Application.Dtos.Overview;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Admin and Manager-and-above only; the title check lives in the service because it depends on the caller's Employee.
    public class OtOverviewController : BaseController
    {
        private const string AdminRole = "Admin";

        private readonly IOtOverviewService _otOverviewService;
        private readonly IEmployeeService _employeeService;

        public OtOverviewController(IOtOverviewService otOverviewService, IEmployeeService employeeService)
        {
            _otOverviewService = otOverviewService;
            _employeeService = employeeService;
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("access")]
        public async Task<ActionResult<ApiResponse<bool>>> GetAccess()
        {
            return Success(await _employeeService.CanViewOverviewAsync(CurrentUserName, User.IsInRole(AdminRole)));
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet]
        public async Task<ActionResult<ApiResponse<OtOverviewDto>>> Get([FromQuery] int year, [FromQuery] int month, [FromQuery] int? workshopId = null)
        {
            var result = await _otOverviewService.GetAsync(CurrentUserName, User.IsInRole(AdminRole), year, month, workshopId);
            if (result == null) return Forbid();
            return Success(result);
        }
    }
}
