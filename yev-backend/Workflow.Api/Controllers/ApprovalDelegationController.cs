using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;
using Workflow.Application.Dtos.ApprovalDelegations;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Api.Controllers
{
    // Delegator is always the current user (never taken from the body); Service blocks editing others' rows.
    public class ApprovalDelegationController : WorkflowBaseController
    {
        private readonly IApprovalDelegationService _approvalDelegationService;

        public ApprovalDelegationController(IApprovalDelegationService approvalDelegationService)
        {
            _approvalDelegationService = approvalDelegationService;
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<ApprovalDelegationDto>>>> GetMine()
        {
            var result = await _approvalDelegationService.GetMineAsync(CurrentUserId);
            return Success(result);
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUpdateApprovalDelegationDto request)
        {
            var result = await _approvalDelegationService.CreateAsync(request, CurrentUserId);
            return CreatedSuccess(nameof(GetMine), new { }, result, "Tạo ủy quyền thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<ApprovalDelegationDto>>> Update(int id, [FromBody] CreateUpdateApprovalDelegationDto request)
        {
            var result = await _approvalDelegationService.UpdateAsync(id, request, CurrentUserId);
            return Success(result, "Cập nhật ủy quyền thành công.");
        }

        [RequirePermission("Workflow.Request.Create")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _approvalDelegationService.DeleteAsync(id, CurrentUserId);
            return Success(true, "Xóa ủy quyền thành công.");
        }
    }
}
