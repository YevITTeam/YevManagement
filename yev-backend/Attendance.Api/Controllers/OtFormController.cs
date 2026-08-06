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
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-forms")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyForms(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _otFormService.GetMyFormsAsync(CurrentUserName, pageIndex, pageSize);
            return Success(result);
        }

        // Draft forms awaiting sign-off from the CURRENT user (Team Leader) — uses the Create
        // permission since the Team Leader role does not have Attendance.OTForm.Approve.
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("pending-submissions")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetPendingSubmissions(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.GetPendingSubmissionsAsync(CurrentUserName, isAdmin, pageIndex, pageSize);
            return Success(result);
        }

        // Forms awaiting approval from the CURRENT user (Department Manager/Workshop Manager/General
        // Director — all via UserApprovalScope; General Director's scope is ScopeType.All).
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetPendingApprovals(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _otFormService.GetPendingApprovalsAsync(CurrentUserName, pageIndex, pageSize);
            return Success(result);
        }

        // History of forms the CURRENT user has Signed/Approved/Rejected (any level) — shared by all 4
        // roles since they all already have Attendance.OTForm.View. Different from my-forms (only
        // shows SELF-CREATED forms) and pending-* (only shows forms NOT YET processed) — this is where
        // you review forms that have ALREADY been processed.
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-actions")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyActions(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50)
        {
            var result = await _otFormService.GetMyActionsAsync(CurrentUserName, pageIndex, pageSize);
            return Success(result);
        }

        // Forms I am LISTED on in the OT employee list (OtFormEmployee) — not necessarily the person
        // who created/signed/approved it. Available to every user (including Role "Nhân viên", only
        // needs OTForm.View).
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

        // Create a form — only creates a draft (Draft), NOT YET signed as "Requester". The form
        // creator is only responsible for data entry; the Team Leader must call POST /{id}/submit
        // themselves to sign before the form actually enters the flow (see docs/attendance-module.md).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.CreateAsync(CurrentUserName, CurrentFullName, isAdmin, request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Tạo đơn tăng ca thành công (đang ở trạng thái nháp, chờ Trưởng nhóm ký duyệt).");
        }

        // Team Leader signs as "Requester" — moves the form from Draft to Pending (awaiting Department
        // Manager). BE automatically takes the signature from the caller's already-registered
        // UserSignature. The caller must be assigned a UserApprovalScope (ApprovalLevel=Submitter,
        // only Role "Trưởng nhóm" can be assigned this) matching the form's group/department, except
        // Admin bypasses this (see docs/attendance-module.md).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost("{id}/submit")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> Submit(int id, [FromBody] ApproveOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.ApproveSubmitterAsync(id, CurrentUserName, CurrentFullName, isAdmin, request);
            return Success(result, "Trưởng nhóm ký duyệt thành công, đơn đã chuyển lên chờ Trưởng phòng.");
        }

        // Edit the entire form — only the creator, and only while the form is still Draft or Pending
        // (Service validates both conditions). Once past the Department Manager level it becomes
        // locked and can no longer be edited (see docs/attendance-module.md).
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

        // Drop ONE employee from the form so the rest of it can still be approved, instead of having to
        // reject the whole form over a single person (see docs/attendance-module.md — Loại nhân viên
        // khỏi đơn). Its own permission because the callers span BOTH sides of the existing split: the
        // Team Leader signing a Draft holds OTForm.Create but NOT .Approve, while the levels above hold
        // .Approve but not .Create. The Service re-validates that the caller is genuinely entitled to
        // act at the level the form is currently sitting at.
        [RequirePermission("Attendance.OTForm.RemoveEmployee")]
        [HttpPost("{id}/employees/remove")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> RemoveEmployee(int id, [FromBody] RemoveOtFormEmployeeDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.RemoveEmployeeAsync(id, CurrentUserName, CurrentFullName, isAdmin, request);
            return Success(result, "Đã loại nhân viên khỏi đơn.");
        }

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
