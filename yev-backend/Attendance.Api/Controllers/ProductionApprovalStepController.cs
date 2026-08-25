using Attendance.Application.Dtos.ProductionApprovalSteps;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class ProductionApprovalStepController : BaseController
    {
        private const string AdminRole = "Admin";
        private readonly IProductionApprovalStepService _productionApprovalStepService;

        public ProductionApprovalStepController(IProductionApprovalStepService productionApprovalStepService)
        {
            _productionApprovalStepService = productionApprovalStepService;
        }

        [RequirePermission("Attendance.ProductionApprovalStep.View")]
        [HttpGet("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<ProductionApprovalStepDto>>>> GetByDepartment(int departmentId)
        {
            var result = await _productionApprovalStepService.GetByDepartmentAsync(CurrentUserName, User.IsInRole(AdminRole), departmentId);
            return Success(result);
        }

        [RequirePermission("Attendance.ProductionApprovalStep.Update")]
        [HttpPut("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<ProductionApprovalStepDto>>>> Replace(
            int departmentId, [FromBody] ReplaceProductionApprovalStepsDto request)
        {
            var result = await _productionApprovalStepService.ReplaceAsync(CurrentUserName, User.IsInRole(AdminRole), departmentId, request);
            return Success(result, "Cập nhật cây duyệt chuyền thành công.");
        }
    }
}
