using Attendance.Application.Dtos.DepartmentApprovalSteps;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class DepartmentApprovalStepController : BaseController
    {
        private const string AdminRole = "Admin";
        private readonly IDepartmentApprovalStepService _departmentApprovalStepService;

        public DepartmentApprovalStepController(IDepartmentApprovalStepService departmentApprovalStepService)
        {
            _departmentApprovalStepService = departmentApprovalStepService;
        }

        [RequirePermission("Attendance.DepartmentApprovalStep.View")]
        [HttpGet("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<DepartmentApprovalStepDto>>>> GetByDepartment(int departmentId)
        {
            var result = await _departmentApprovalStepService.GetByDepartmentAsync(CurrentUserName, User.IsInRole(AdminRole), departmentId);
            return Success(result);
        }

        [RequirePermission("Attendance.DepartmentApprovalStep.Update")]
        [HttpPut("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<DepartmentApprovalStepDto>>>> Replace(
            int departmentId, [FromBody] ReplaceDepartmentApprovalStepsDto request)
        {
            var result = await _departmentApprovalStepService.ReplaceAsync(CurrentUserName, User.IsInRole(AdminRole), departmentId, request);
            return Success(result, "Cập nhật cây duyệt thành công.");
        }
    }
}
