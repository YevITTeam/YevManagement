using Attendance.Application.Dtos.DepartmentApprovalSteps;
using Attendance.Application.Dtos.Departments;
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

        // Departments for the approval-tree picker: all for Admin, else the ones the caller coordinates directly or via a Group.
        [RequirePermission("Attendance.DepartmentApprovalStep.View")]
        [HttpGet("my-departments")]
        public async Task<ActionResult<ApiResponse<List<ApprovalTreeDepartmentDto>>>> GetMyDepartments()
        {
            var result = await _departmentApprovalStepService.GetMyManagedDepartmentsAsync(CurrentUserName, User.IsInRole(AdminRole));
            return Success(result);
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
