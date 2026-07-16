using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class OtFormController : BaseController
    {
        private const string GeneralDirectorRole = "Tổng Giám Đốc";
        private const string AdminRole = "Admin";

        private readonly IOtFormService _otFormService;

        public OtFormController(IOtFormService otFormService)
        {
            _otFormService = otFormService;
        }

        // Đơn do CHÍNH mình tạo (Trưởng Group xem lại đơn của nhóm mình).
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-forms")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyForms(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _otFormService.GetMyFormsAsync(CurrentUserName, pageIndex, pageSize);
            return Success(result);
        }

        // Đơn đang chờ CHÍNH mình duyệt (Trưởng phòng/Trưởng xưởng theo UserApprovalScope, hoặc TGĐ bypass scope).
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetPendingApprovals(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var isGeneralDirector = User.IsInRole(GeneralDirectorRole);
            var result = await _otFormService.GetPendingApprovalsAsync(CurrentUserName, isGeneralDirector, pageIndex, pageSize);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> GetById(int id)
        {
            var result = await _otFormService.GetByIdAsync(id);
            return Success(result);
        }

        // Tạo đơn — chữ ký "Người đề nghị" BE tự lấy từ UserSignature đã đăng ký sẵn của người gọi.
        // Người gọi phải được gán UserApprovalScope (ApprovalLevel=Submitter) khớp group/department của
        // đơn, trừ Admin bypass — cho phép nhiều người trong cùng Group cùng tạo đơn, không chỉ 1 Trưởng Group.
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.CreateAsync(CurrentUserName, CurrentFullName, isAdmin, request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Tạo đơn tăng ca thành công.");
        }

        // Sửa toàn bộ đơn — chỉ chính người tạo và chỉ khi đơn còn Pending (Service validate cả 2 điều
        // kiện). Qua ít nhất 1 cấp duyệt là khóa cứng, không sửa được nữa (xem docs/attendance-module.md).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> Update(int id, [FromBody] UpdateOtFormDto request)
        {
            var result = await _otFormService.UpdateAsync(id, CurrentUserName, request);
            return Success(result, "Cập nhật đơn tăng ca thành công.");
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<ApiResponse<bool>>> Approve(int id, [FromBody] ApproveOtFormDto request)
        {
            var isGeneralDirector = User.IsInRole(GeneralDirectorRole);
            await _otFormService.ApproveAsync(id, CurrentUserName, CurrentFullName, isGeneralDirector, request);
            return Success(true, "Duyệt đơn thành công.");
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("{id}/reject")]
        public async Task<ActionResult<ApiResponse<bool>>> Reject(int id, [FromBody] RejectOtFormDto request)
        {
            var isGeneralDirector = User.IsInRole(GeneralDirectorRole);
            await _otFormService.RejectAsync(id, CurrentUserName, CurrentFullName, isGeneralDirector, request);
            return Success(true, "Từ chối đơn thành công.");
        }

        // 3 action công khai bên dưới phục vụ trang xác nhận nhỏ mà FE mở khi người duyệt (Trưởng
        // phòng/Trưởng xưởng/Tổng Giám Đốc) bấm link Duyệt/Từ chối trong email — KÊNH BỔ SUNG cho
        // 2 nút Approve/Reject trong app ở trên, không thay thế. Token tự nó là thông tin xác thực
        // duy nhất (xem docs/attendance-module.md) — đây là bề mặt [AllowAnonymous] thứ 2 của hệ thống.
        [AllowAnonymous]
        [HttpGet("email-confirm/{token}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> GetByEmailToken(string token)
        {
            var result = await _otFormService.GetByEmailTokenAsync(token);
            return Success(result);
        }

        [AllowAnonymous]
        [HttpPost("email-confirm/{token}/approve")]
        public async Task<ActionResult<ApiResponse<bool>>> ApproveByEmailToken(string token, [FromBody] ApproveOtFormDto request)
        {
            await _otFormService.ApproveByEmailTokenAsync(token, request);
            return Success(true, "Duyệt đơn thành công.");
        }

        [AllowAnonymous]
        [HttpPost("email-confirm/{token}/reject")]
        public async Task<ActionResult<ApiResponse<bool>>> RejectByEmailToken(string token, [FromBody] RejectOtFormDto request)
        {
            await _otFormService.RejectByEmailTokenAsync(token, request);
            return Success(true, "Từ chối đơn thành công.");
        }
    }
}
