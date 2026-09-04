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
        private const string AdminRole = "Admin";

        private readonly IOtFormService _otFormService;

        public OtFormController(IOtFormService otFormService)
        {
            _otFormService = otFormService;
        }

        // Forms created by the CURRENT user (Team Leader reviewing their own team's forms).
        // fromDate/toDate lọc theo OtForm.Date (bao gồm cả 2 đầu mút), status lọc theo đúng giá trị
        // OtFormStatus (§2) — cả 3 optional, dùng chung cho cả 5 endpoint danh sách bên dưới
        // (2026-08-06, xem docs/attendance-module.md §Lọc danh sách đơn).
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-forms")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyForms(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null)
        {
            var result = await _otFormService.GetMyFormsAsync(CurrentUserName, pageIndex, pageSize, fromDate, toDate, status);
            return Success(result);
        }

        // Forms awaiting approval from the CURRENT user — "current step" of a form is its Pending
        // OtFormApprovalStep with the smallest StepOrder (xem GetPendingApprovalsAsync).
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetPendingApprovals(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null,
            [FromQuery] int? productionLineId = null, [FromQuery] int? productionTeamId = null, [FromQuery] int? productionShiftTeamId = null)
        {
            var result = await _otFormService.GetPendingApprovalsAsync(
                CurrentUserName, pageIndex, pageSize, fromDate, toDate, status,
                productionLineId, productionTeamId, productionShiftTeamId);
            return Success(result);
        }

        // Đếm nhanh cho badge sidebar FE — xem OtFormService.GetPendingApprovalsCountAsync.
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals/count")]
        public async Task<ActionResult<ApiResponse<int>>> GetPendingApprovalsCount()
        {
            var result = await _otFormService.GetPendingApprovalsCountAsync(CurrentUserName);
            return Success(result);
        }

        // Lịch mini ở màn Duyệt hàng loạt — số đơn chưa duyệt theo TỪNG ngày (2026-09-04, xem
        // docs/attendance-module.md §Nâng cấp màn Duyệt hàng loạt).
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals/dates")]
        public async Task<ActionResult<ApiResponse<List<PendingApprovalDateCountDto>>>> GetPendingApprovalDates(
            [FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate)
        {
            var result = await _otFormService.GetPendingApprovalDatesAsync(CurrentUserName, fromDate, toDate);
            return Success(result);
        }

        // History of forms the CURRENT user has Signed/Approved/Rejected (any level) — shared by all 4
        // roles since they all already have Attendance.OTForm.View. Different from my-forms (only
        // shows SELF-CREATED forms) and pending-* (only shows forms NOT YET processed) — this is where
        // you review forms that have ALREADY been processed.
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-actions")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyActions(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null)
        {
            var result = await _otFormService.GetMyActionsAsync(CurrentUserName, pageIndex, pageSize, fromDate, toDate, status);
            return Success(result);
        }

        // Forms I am LISTED on in the OT employee list (OtFormEmployee) — not necessarily the person
        // who created/signed/approved it. Available to every user (including Role "Nhân viên", only
        // needs OTForm.View).
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-participations")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyParticipations(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null)
        {
            var result = await _otFormService.GetMyParticipationsAsync(CurrentUserName, pageIndex, pageSize, fromDate, toDate, status);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> GetById(int id)
        {
            var result = await _otFormService.GetByIdAsync(id);
            return Success(result);
        }

        // The Group(s) the caller is allowed to create forms for — FE calls this before opening the
        // "Create OT form" screen to pre-fill the Group/Department instead of forcing a free choice
        // (Employee/Team Leader can only create for their own fixed scope anyway). Empty array for
        // Admin (no restriction) — FE keeps the old dropdown as-is.
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("my-create-scopes")]
        public async Task<ActionResult<ApiResponse<List<MyCreateScopeItemDto>>>> GetMyCreateScopes()
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.GetMyCreateScopesAsync(CurrentUserName, isAdmin);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost("check-overlap")]
        public async Task<ActionResult<ApiResponse<List<int>>>> CheckOverlap([FromBody] CheckOtFormOverlapDto request)
        {
            var result = await _otFormService.CheckOverlapAsync(request);
            return Success(result);
        }

        // Create a form — tạo xong vào chuỗi duyệt Cây chức vụ NGAY LẬP TỨC, không còn giai đoạn Draft
        // (2026-08-07, Giai đoạn 3.1, xem docs/attendance-module.md §Cây chức vụ).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.CreateAsync(CurrentUserName, CurrentFullName, isAdmin, request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Tạo đơn tăng ca thành công.");
        }

        // Đơn theo Nhóm: chỉ người tạo, chỉ khi Status=InApproval VÀ chưa bước nào Approved. Đơn "theo
        // chuyền": theo TỪNG BƯỚC — ai đang là candidate của bước Pending hiện tại thì sửa được (Giai
        // đoạn 5, 2026-08-27, xem OtFormService.UpdateAsync + docs/attendance-module.md §Chế tạo).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> Update(int id, [FromBody] UpdateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.UpdateAsync(id, CurrentUserName, CurrentFullName, isAdmin, request);
            return Success(result, "Cập nhật đơn tăng ca thành công.");
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<ApiResponse<bool>>> Approve(int id, [FromBody] ApproveOtFormDto request)
        {
            await _otFormService.ApproveAsync(id, CurrentUserName, CurrentFullName, request);
            return Success(true, "Duyệt đơn thành công.");
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("{id}/reject")]
        public async Task<ActionResult<ApiResponse<bool>>> Reject(int id, [FromBody] RejectOtFormDto request)
        {
            await _otFormService.RejectAsync(id, CurrentUserName, CurrentFullName, request);
            return Success(true, "Từ chối đơn thành công.");
        }

        // Ký/Từ chối hàng loạt (2026-08-27) — xem BulkApproveOtFormDto/BulkRejectOtFormDto. Trả 200 kèm
        // kết quả TỪNG đơn dù có đơn lỗi (không phải all-or-nothing) — FE tự đọc mảng result để báo
        // đúng đơn nào thành công/thất bại.
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("bulk-approve")]
        public async Task<ActionResult<ApiResponse<List<BulkOtFormActionResultItemDto>>>> BulkApprove([FromBody] BulkApproveOtFormDto request)
        {
            var results = await _otFormService.BulkApproveAsync(CurrentUserName, CurrentFullName, request);
            return Success(results, "Đã xử lý ký hàng loạt.");
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("bulk-reject")]
        public async Task<ActionResult<ApiResponse<List<BulkOtFormActionResultItemDto>>>> BulkReject([FromBody] BulkRejectOtFormDto request)
        {
            var results = await _otFormService.BulkRejectAsync(CurrentUserName, CurrentFullName, request);
            return Success(results, "Đã xử lý từ chối hàng loạt.");
        }

        // Admin-only — xoá đơn kẹt vĩnh viễn (chuỗi duyệt thiếu candidate ở 1 bước, không resolve lại
        // được vì candidate đã snapshot 1 lần lúc tạo). Chặn ở Service nếu đơn đã Completed (đã cộng
        // lũy kế thật) — xem docs/attendance-module.md §Cây chức vụ.
        [RequirePermission("Attendance.OTForm.Delete")]
        [HttpPost("{id}/delete")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id, [FromBody] DeleteOtFormDto request)
        {
            await _otFormService.DeleteAsync(id, CurrentUserName, CurrentFullName, request);
            return Success(true, "Đã xoá đơn.");
        }

        // Thêm/loại nhân viên khỏi đơn trong-app đã gộp vào PUT {id} (UpdateAsync) — 2026-09-04, xem
        // docs/attendance-module.md §Gộp thêm/xóa NV vào Sửa đơn. Route "{id}/employees/remove" (kênh
        // email, KHÔNG cần mật khẩu cấp 2) vẫn còn — xem RemoveEmployeeByEmailToken bên dưới.

        // The 3 public actions below serve the small confirmation page the FE opens when an approver
        // (Department Manager/Workshop Manager/General Director) clicks the Approve/Reject link in the
        // email — a SUPPLEMENTARY CHANNEL to the 2 Approve/Reject buttons in the app above, not a
        // replacement. The token itself is the sole authentication credential (see
        // docs/attendance-module.md) — this is the 2nd [AllowAnonymous] surface in the system.
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

        // Same "loại nhân viên khỏi đơn" action as {id}/employees/remove above, reachable from the
        // email-confirm page — token is the sole credential, deliberately NO secondary password (khác
        // 2 action Approve/Reject qua email ở trên vẫn giữ, chốt qua AskUserQuestion 2026-07-31, xem
        // docs/attendance-module.md). Does NOT consume the token, since the approver may still need it
        // to Approve/Reject right after.
        [AllowAnonymous]
        [HttpPost("email-confirm/{token}/employees/remove")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> RemoveEmployeeByEmailToken(string token, [FromBody] RemoveOtFormEmployeeByEmailTokenDto request)
        {
            var result = await _otFormService.RemoveEmployeeByEmailTokenAsync(token, request);
            return Success(result, "Đã loại nhân viên khỏi đơn.");
        }
    }
}
