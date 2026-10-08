using Attendance.Application.Dtos.ApprovalDelegations;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Delegator is always the caller (never taken from the body) to rule out impersonation.
    public class ApprovalDelegationController : BaseController
    {
        private readonly IApprovalDelegationService _service;

        public ApprovalDelegationController(IApprovalDelegationService service)
        {
            _service = service;
        }

        [RequirePermission("Attendance.OTForm.Delegate")]
        [HttpGet("mine")]
        public async Task<ActionResult<ApiResponse<List<ApprovalDelegationDto>>>> GetMine()
            => Success(await _service.GetMineAsync(CurrentUserName));

        [RequirePermission("Attendance.OTForm.Delegate")]
        [HttpGet("delegate-options")]
        public async Task<ActionResult<ApiResponse<List<DelegateOptionDto>>>> GetDelegateOptions()
            => Success(await _service.GetDelegateOptionsAsync(CurrentUserName));

        [RequirePermission("Attendance.OTForm.Delegate")]
        [HttpPost]
        public async Task<ActionResult<ApiResponse<ApprovalDelegationDto>>> Create([FromBody] CreateUpdateApprovalDelegationDto request)
            => Success(await _service.CreateAsync(CurrentUserName, request), "Đã tạo ủy quyền duyệt.");

        [RequirePermission("Attendance.OTForm.Delegate")]
        [HttpPut("{id:int}")]
        public async Task<ActionResult<ApiResponse<ApprovalDelegationDto>>> Update(int id, [FromBody] CreateUpdateApprovalDelegationDto request)
            => Success(await _service.UpdateAsync(id, CurrentUserName, request), "Đã cập nhật ủy quyền duyệt.");

        [RequirePermission("Attendance.OTForm.Delegate")]
        [HttpDelete("{id:int}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _service.DeleteAsync(id, CurrentUserName);
            return Success(true, "Đã xóa ủy quyền duyệt.");
        }
    }
}
