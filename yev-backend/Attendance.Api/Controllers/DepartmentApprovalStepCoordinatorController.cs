using Attendance.Application.Dtos.DepartmentApprovalStepCoordinators;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class DepartmentApprovalStepCoordinatorController : BaseController
    {
        private readonly IDepartmentApprovalStepCoordinatorService _departmentApprovalStepCoordinatorService;

        public DepartmentApprovalStepCoordinatorController(IDepartmentApprovalStepCoordinatorService departmentApprovalStepCoordinatorService)
        {
            _departmentApprovalStepCoordinatorService = departmentApprovalStepCoordinatorService;
        }

        [RequirePermission("Attendance.DepartmentApprovalStepCoordinator.View")]
        [HttpGet("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<DepartmentApprovalStepCoordinatorDto>>>> GetByDepartment(int departmentId)
        {
            var result = await _departmentApprovalStepCoordinatorService.GetByDepartmentAsync(departmentId);
            return Success(result);
        }

        [RequirePermission("Attendance.DepartmentApprovalStepCoordinator.Update")]
        [HttpPut("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<DepartmentApprovalStepCoordinatorDto>>>> Replace(
            int departmentId, [FromBody] ReplaceDepartmentApprovalStepCoordinatorsDto request)
        {
            var result = await _departmentApprovalStepCoordinatorService.ReplaceAsync(departmentId, request);
            return Success(result, "Cập nhật người phụ trách thành công.");
        }
    }
}
