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

        // Đơn do CHÍNH mình tạo (Trưởng nhóm xem lại đơn của nhóm mình).
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-forms")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyForms(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _otFormService.GetMyFormsAsync(CurrentUserName, pageIndex, pageSize);
            return Success(result);
        }

        // Đơn Draft đang chờ CHÍNH mình (Trưởng nhóm) ký duyệt — dùng permission Create vì Role
        // Trưởng nhóm không có Attendance.OTForm.Approve.
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("pending-submissions")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetPendingSubmissions(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.GetPendingSubmissionsAsync(CurrentUserName, isAdmin, pageIndex, pageSize);
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

        // Lịch sử đơn CHÍNH mình đã Ký/Duyệt/Từ chối (bất kỳ cấp nào) — dùng chung cho cả 4 vai trò vì
        // tất cả đều có sẵn Attendance.OTForm.View. Khác my-forms (chỉ hiện đơn TỰ TẠO) và pending-*
        // (chỉ hiện đơn CHƯA xử lý) — đây là nơi xem lại đơn ĐÃ xử lý xong.
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-actions")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyActions(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _otFormService.GetMyActionsAsync(CurrentUserName, pageIndex, pageSize);
            return Success(result);
        }

        // Đơn tôi CÓ TÊN trong danh sách nhân viên tăng ca (OtFormEmployee) — không nhất thiết là người
        // tạo/ký/duyệt. Dành cho mọi user (kể cả Role "Nhân viên", chỉ cần OTForm.View).
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-participations")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyParticipations(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _otFormService.GetMyParticipationsAsync(CurrentUserName, pageIndex, pageSize);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> GetById(int id)
        {
            var result = await _otFormService.GetByIdAsync(id);
            return Success(result);
        }

        // (Các) Group người gọi được phép tạo đơn — FE gọi trước khi mở màn "Tạo đơn tăng ca" để tự
        // điền sẵn Bộ phận/Phòng ban thay vì bắt chọn tự do (Nhân viên/Trưởng nhóm vốn chỉ tạo được
        // cho đúng phạm vi cố định). Mảng rỗng với Admin (không giới hạn) — FE giữ nguyên dropdown cũ.
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("my-create-scopes")]
        public async Task<ActionResult<ApiResponse<List<MyCreateScopeItemDto>>>> GetMyCreateScopes()
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.GetMyCreateScopesAsync(CurrentUserName, isAdmin);
            return Success(result);
        }

        // Tạo đơn — chỉ tạo bản nháp (Draft), CHƯA ký "Người đề nghị". Người tạo đơn chỉ chịu trách
        // nhiệm nhập liệu; Trưởng nhóm phải tự gọi POST /{id}/submit để ký duyệt thì đơn mới thật sự
        // vào luồng (xem docs/attendance-module.md).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.CreateAsync(CurrentUserName, CurrentFullName, isAdmin, request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Tạo đơn tăng ca thành công (đang ở trạng thái nháp, chờ Trưởng nhóm ký duyệt).");
        }

        // Trưởng nhóm ký duyệt "Người đề nghị" — chuyển đơn từ Draft sang Pending (chờ Trưởng phòng).
        // BE tự lấy chữ ký từ UserSignature đã đăng ký sẵn của người gọi. Người gọi phải được gán
        // UserApprovalScope (ApprovalLevel=Submitter, chỉ Role "Trưởng nhóm" mới được gán) khớp
        // group/department của đơn, trừ Admin bypass (xem docs/attendance-module.md).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost("{id}/submit")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> Submit(int id, [FromBody] ApproveOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.ApproveSubmitterAsync(id, CurrentUserName, CurrentFullName, isAdmin, request);
            return Success(result, "Trưởng nhóm ký duyệt thành công, đơn đã chuyển lên chờ Trưởng phòng.");
        }

        // Sửa toàn bộ đơn — chỉ chính người tạo và chỉ khi đơn còn Draft hoặc Pending (Service validate
        // cả 2 điều kiện). Qua cấp Trưởng phòng trở lên là khóa cứng, không sửa được nữa (xem docs/attendance-module.md).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> Update(int id, [FromBody] UpdateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.UpdateAsync(id, CurrentUserName, isAdmin, request);
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
