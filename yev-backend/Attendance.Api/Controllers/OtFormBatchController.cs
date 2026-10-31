using Attendance.Application.Dtos.OtFormBatches;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // Email channel for the daily manager-level digest; in-app approval goes through OtForm pending-approvals.
    public class OtFormBatchController : BaseController
    {
        private readonly IOtFormService _otFormService;

        public OtFormBatchController(IOtFormService otFormService)
        {
            _otFormService = otFormService;
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
