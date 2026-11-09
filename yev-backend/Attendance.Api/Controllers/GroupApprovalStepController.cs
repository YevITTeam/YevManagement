using Attendance.Application.Dtos.GroupApprovalSteps;
using Attendance.Application.Dtos.Groups;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class GroupApprovalStepController : BaseController
    {
        private const string AdminRole = "Admin";
        private readonly IGroupApprovalStepService _groupApprovalStepService;

        public GroupApprovalStepController(IGroupApprovalStepService groupApprovalStepService)
        {
            _groupApprovalStepService = groupApprovalStepService;
        }

        [RequirePermission("Attendance.GroupApprovalStep.View")]
        [HttpGet("my-groups")]
        public async Task<ActionResult<ApiResponse<List<GroupDto>>>> GetMyGroups()
        {
            var result = await _groupApprovalStepService.GetMyManagedGroupsAsync(CurrentUserName, User.IsInRole(AdminRole));
            return Success(result);
        }

        [RequirePermission("Attendance.GroupApprovalStep.View")]
        [HttpGet("by-group/{groupId}")]
        public async Task<ActionResult<ApiResponse<List<GroupApprovalStepDto>>>> GetByGroup(int groupId)
        {
            var result = await _groupApprovalStepService.GetByGroupAsync(CurrentUserName, User.IsInRole(AdminRole), groupId);
            return Success(result);
        }

        [RequirePermission("Attendance.GroupApprovalStep.Update")]
        [HttpPut("by-group/{groupId}")]
        public async Task<ActionResult<ApiResponse<List<GroupApprovalStepDto>>>> Replace(
            int groupId, [FromBody] ReplaceGroupApprovalStepsDto request)
        {
            var result = await _groupApprovalStepService.ReplaceAsync(CurrentUserName, User.IsInRole(AdminRole), groupId, request);
            return Success(result, "Cập nhật cây duyệt thành công.");
        }

        [RequirePermission("Attendance.GroupApprovalStep.View")]
        [HttpGet("by-group/{groupId}/borrowed-approvers")]
        public async Task<ActionResult<ApiResponse<GroupBorrowedApproversDto>>> GetBorrowedApprovers(int groupId)
        {
            var result = await _groupApprovalStepService.GetBorrowedApproversAsync(CurrentUserName, User.IsInRole(AdminRole), groupId);
            return Success(result);
        }

        [RequirePermission("Attendance.GroupApprovalStep.Update")]
        [HttpPut("by-group/{groupId}/borrowed-approvers")]
        public async Task<ActionResult<ApiResponse<GroupBorrowedApproversDto>>> ReplaceBorrowedApprovers(
            int groupId, [FromBody] ReplaceGroupBorrowedApproversDto request)
        {
            var result = await _groupApprovalStepService.ReplaceBorrowedApproversAsync(CurrentUserName, User.IsInRole(AdminRole), groupId, request);
            return Success(result, "Cập nhật danh sách thành công.");
        }
    }
}
