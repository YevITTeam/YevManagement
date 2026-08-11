using Attendance.Application.Dtos.GroupApprovalStepCoordinators;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class GroupApprovalStepCoordinatorController : BaseController
    {
        private readonly IGroupApprovalStepCoordinatorService _groupApprovalStepCoordinatorService;

        public GroupApprovalStepCoordinatorController(IGroupApprovalStepCoordinatorService groupApprovalStepCoordinatorService)
        {
            _groupApprovalStepCoordinatorService = groupApprovalStepCoordinatorService;
        }

        [RequirePermission("Attendance.GroupApprovalStepCoordinator.View")]
        [HttpGet("by-group/{groupId}")]
        public async Task<ActionResult<ApiResponse<List<GroupApprovalStepCoordinatorDto>>>> GetByGroup(int groupId)
        {
            var result = await _groupApprovalStepCoordinatorService.GetByGroupAsync(groupId);
            return Success(result);
        }

        [RequirePermission("Attendance.GroupApprovalStepCoordinator.Update")]
        [HttpPut("by-group/{groupId}")]
        public async Task<ActionResult<ApiResponse<List<GroupApprovalStepCoordinatorDto>>>> Replace(
            int groupId, [FromBody] ReplaceGroupApprovalStepCoordinatorsDto request)
        {
            var result = await _groupApprovalStepCoordinatorService.ReplaceAsync(groupId, request);
            return Success(result, "Cập nhật người phụ trách thành công.");
        }
    }
}
