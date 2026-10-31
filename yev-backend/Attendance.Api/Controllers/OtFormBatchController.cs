using Attendance.Application.Dtos.OtFormBatches;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Batches pending OtForms per approval level so they are approved once; reuses OTForm.Approve and the per-step candidate check.
    public class OtFormBatchController : BaseController
    {
        private readonly IOtFormService _otFormService;

        public OtFormBatchController(IOtFormService otFormService)
        {
            _otFormService = otFormService;
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormBatchListItemDto>>>> GetGridList(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var isAdmin = User.IsInRole("Admin");
            var result = await _otFormService.GetBatchesAsync(CurrentUserName, isAdmin, pageIndex, pageSize);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormBatchDto>>> GetById(int id)
        {
            var result = await _otFormService.GetBatchByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<ApiResponse<OtFormBatchDto>>> Process(int id, [FromBody] ProcessOtFormBatchDto request)
        {
            var result = await _otFormService.ProcessBatchAsync(id, CurrentUserName, CurrentFullName, request);
            return Success(result, "Duyệt đơn tổng thành công.");
        }

        // Email channel: the token is the only credential, as in OtFormController.
        [AllowAnonymous]
        [HttpGet("email-confirm/{token}")]
        public async Task<ActionResult<ApiResponse<OtFormBatchDto>>> GetByEmailToken(string token)
        {
            var result = await _otFormService.GetBatchByEmailTokenAsync(token);
            return Success(result);
        }

        [AllowAnonymous]
        [HttpPost("email-confirm/{token}/approve")]
        public async Task<ActionResult<ApiResponse<OtFormBatchDto>>> ProcessByEmailToken(string token, [FromBody] ProcessOtFormBatchDto request)
        {
            var result = await _otFormService.ProcessBatchByEmailTokenAsync(token, request);
            return Success(result, "Duyệt đơn tổng thành công.");
        }

        // Runs the daily batch now instead of waiting for BatchAutoSendTime; Admin-level because it affects every Department.
        [RequirePermission("Attendance.Setting.Update")]
        [HttpPost("run-now")]
        public async Task<ActionResult<ApiResponse<bool>>> RunNow()
        {
            await _otFormService.RunDailyBatchSweepAsync();
            return Success(true, "Đã chạy gom đơn tổng ngay.");
        }
    }
}
