using Attendance.Application.Dtos.OtFormBatches;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    // "Đơn tổng" — gom nhiều OtForm đang chờ đúng cấp DepartmentManager của cùng 1 Department, duyệt 1
    // lần thay vì từng đơn (see docs/attendance-module.md — §Đơn tổng). Tái dùng permission
    // Attendance.OTForm.Approve đã gán sẵn cho Trưởng phòng — không cần permission mới, gate dữ liệu vẫn
    // qua UserApprovalScope(DepartmentManager) như mọi nơi khác.
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

        // Kênh bổ sung qua email — cùng nguyên tắc [AllowAnonymous] như OtFormController: token tự nó
        // là thông tin xác thực duy nhất (see docs/attendance-module.md).
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

        // Chạy ngay đợt gom "Đơn tổng" hằng ngày (bình thường tự chạy theo AttendanceSetting.
        // BatchAutoSendTime, xem OtFormBatchBackgroundService) — dùng khi test hoặc có lý do cấp bách
        // cần gửi ngay, không đợi tới giờ cấu hình. Cùng quyền với sửa Cấu hình (hành động cấp Admin,
        // ảnh hưởng toàn bộ Department chứ không riêng 1 đơn).
        [RequirePermission("Attendance.Setting.Update")]
        [HttpPost("run-now")]
        public async Task<ActionResult<ApiResponse<bool>>> RunNow()
        {
            await _otFormService.RunDailyBatchSweepAsync();
            return Success(true, "Đã chạy gom đơn tổng ngay.");
        }
    }
}
