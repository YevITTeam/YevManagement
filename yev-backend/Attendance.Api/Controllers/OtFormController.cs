using Shared.Core.Exceptions;
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

        // fromDate/toDate filter OtForm.Date inclusively; shared by the list endpoints below.
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-forms")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyForms(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null,
            [FromQuery] int? groupId = null, [FromQuery] int? departmentId = null,
            [FromQuery] int? productionLineId = null, [FromQuery] int? productionTeamId = null, [FromQuery] int? productionShiftTeamId = null, [FromQuery] int? workshopId = null, [FromQuery] bool? isProductionForm = null)
        {
            var result = await _otFormService.GetMyFormsAsync(
                CurrentUserName, pageIndex, pageSize, fromDate, toDate, status,
                groupId, departmentId, productionLineId, productionTeamId, productionShiftTeamId, workshopId, isProductionForm);
            return Success(result);
        }

        // Forms awaiting approval from the CURRENT user — "current step" of a form is its Pending
        // OtFormApprovalStep with the smallest StepOrder (xem GetPendingApprovalsAsync).
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetPendingApprovals(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null,
            [FromQuery] int? groupId = null, [FromQuery] int? departmentId = null,
            [FromQuery] int? productionLineId = null, [FromQuery] int? productionTeamId = null, [FromQuery] int? productionShiftTeamId = null, [FromQuery] int? workshopId = null, [FromQuery] bool? isProductionForm = null)
        {
            var result = await _otFormService.GetPendingApprovalsAsync(
                CurrentUserName, pageIndex, pageSize, fromDate, toDate, status,
                groupId, departmentId, productionLineId, productionTeamId, productionShiftTeamId, workshopId, isProductionForm);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals/count")]
        public async Task<ActionResult<ApiResponse<int>>> GetPendingApprovalsCount()
        {
            var result = await _otFormService.GetPendingApprovalsCountAsync(CurrentUserName);
            return Success(result);
        }

        // Pending count per day for the bulk-approval mini calendar.
        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpGet("pending-approvals/dates")]
        public async Task<ActionResult<ApiResponse<List<PendingApprovalDateCountDto>>>> GetPendingApprovalDates(
            [FromQuery] DateOnly fromDate, [FromQuery] DateOnly toDate)
        {
            var result = await _otFormService.GetPendingApprovalDatesAsync(CurrentUserName, fromDate, toDate);
            return Success(result);
        }

        // Forms the caller already processed (any level), unlike my-forms (self-created) and pending-* (not yet processed).
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-actions")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyActions(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null,
            [FromQuery] int? groupId = null, [FromQuery] int? departmentId = null,
            [FromQuery] int? productionLineId = null, [FromQuery] int? productionTeamId = null, [FromQuery] int? productionShiftTeamId = null, [FromQuery] int? workshopId = null, [FromQuery] bool? isProductionForm = null)
        {
            var result = await _otFormService.GetMyActionsAsync(
                CurrentUserName, pageIndex, pageSize, fromDate, toDate, status,
                groupId, departmentId, productionLineId, productionTeamId, productionShiftTeamId, workshopId, isProductionForm);
            return Success(result);
        }

        // Forms listing the caller as an OT employee; needs only OTForm.View.
        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("my-participations")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetMyParticipations(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null,
            [FromQuery] int? groupId = null, [FromQuery] int? departmentId = null,
            [FromQuery] int? productionLineId = null, [FromQuery] int? productionTeamId = null, [FromQuery] int? productionShiftTeamId = null, [FromQuery] int? workshopId = null, [FromQuery] bool? isProductionForm = null)
        {
            var result = await _otFormService.GetMyParticipationsAsync(
                CurrentUserName, pageIndex, pageSize, fromDate, toDate, status,
                groupId, departmentId, productionLineId, productionTeamId, productionShiftTeamId, workshopId, isProductionForm);
            return Success(result);
        }

        // Global list for Admin, unfiltered by caller; OTForm.ViewAll is Admin-only.
        [RequirePermission("Attendance.OTForm.ViewAll")]
        [HttpGet("all-forms")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtFormListItemDto>>>> GetAllForms(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50,
            [FromQuery] DateOnly? fromDate = null, [FromQuery] DateOnly? toDate = null, [FromQuery] int? status = null,
            [FromQuery] int? groupId = null, [FromQuery] int? departmentId = null,
            [FromQuery] int? productionLineId = null, [FromQuery] int? productionTeamId = null, [FromQuery] int? productionShiftTeamId = null, [FromQuery] int? workshopId = null, [FromQuery] bool? isProductionForm = null)
        {
            var result = await _otFormService.GetAllFormsAsync(
                pageIndex, pageSize, fromDate, toDate, status,
                groupId, departmentId, productionLineId, productionTeamId, productionShiftTeamId, workshopId, isProductionForm);
            return Success(result);
        }

        [RequirePermission("Attendance.OTForm.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> GetById(int id)
        {
            var result = await _otFormService.GetByIdAsync(id);
            return Success(result);
        }

        // Pre-fills the create screen with the caller's allowed Group(s); empty for Admin (no restriction).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpGet("my-create-scopes")]
        public async Task<ActionResult<ApiResponse<List<MyCreateScopeItemDto>>>> GetMyCreateScopes()
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.GetMyCreateScopesAsync(CurrentUserName, isAdmin);
            return Success(result);
        }

        // Lets the FE pre-fill and lock Team/Line/Shift for Line Leaders; empty for Admin or non-leaders.
        [RequirePermission("Attendance.OTForm.CreateProduction")]
        [HttpGet("my-production-create-scopes")]
        public async Task<ActionResult<ApiResponse<List<MyProductionCreateScopeItemDto>>>> GetMyProductionCreateScopes()
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.GetMyProductionCreateScopesAsync(CurrentUserName, isAdmin);
            return Success(result);
        }

        // Create and CreateProduction are separate permissions; accept either so production-only Line Leaders can check overlaps.
        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpPost("check-overlap")]
        public async Task<ActionResult<ApiResponse<List<int>>>> CheckOverlap([FromBody] CheckOtFormOverlapDto request)
        {
            var result = await _otFormService.CheckOverlapAsync(request);
            return Success(result);
        }

        // Accepts either Create or CreateProduction; the mode-specific permission is re-checked below so
        // neither can be used to create the other kind of form.
        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            if (request.IsProductionForm)
            {
                if (!User.HasClaim("Permission", "Attendance.OTForm.CreateProduction"))
                    throw new DomainException("Bạn không có quyền tạo đơn tăng ca theo chuyền.");
            }
            else if (!User.HasClaim("Permission", "Attendance.OTForm.Create"))
            {
                throw new DomainException("Bạn không có quyền tạo đơn tăng ca theo Nhóm.");
            }
            var result = await _otFormService.CreateAsync(CurrentUserName, CurrentFullName, isAdmin, request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Tạo đơn tăng ca thành công.");
        }

        // Office forms for several groups at once (one form per group, all or nothing).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost("multi-group")]
        public async Task<ActionResult<ApiResponse<List<OtFormDto>>>> CreateMany([FromBody] CreateManyOtFormsDto request)
        {
            var result = await _otFormService.CreateManyAsync(CurrentUserName, CurrentFullName, User.IsInRole(AdminRole), request);
            return Success(result, $"Đã tạo {result.Count} đơn tăng ca.");
        }

        // Accepts either permission; OtFormService.UpdateAsync enforces the real per-step/scope rules.
        [RequirePermission("Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> Update(int id, [FromBody] UpdateOtFormDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.UpdateAsync(id, CurrentUserName, CurrentFullName, isAdmin, request);
            return Success(result, "Cập nhật đơn tăng ca thành công.");
        }

        // Lets current-step candidates drop employees without going through UpdateAsync; no SecondaryPassword needed.
        [RequirePermission("Attendance.OTForm.RemoveEmployee")]
        [HttpPost("{id}/employees/remove")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> RemoveEmployee(int id, [FromBody] RemoveOtFormEmployeeDto request)
        {
            var isAdmin = User.IsInRole(AdminRole);
            var result = await _otFormService.RemoveEmployeeAsync(id, CurrentUserName, CurrentFullName, isAdmin, request);
            return Success(result, "Loại nhân viên khỏi đơn thành công.");
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

        // Returns 200 with a per-form result (not all-or-nothing) so the FE can show which forms failed.
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

        // For forms stuck forever (a step has no candidate and candidates were snapshotted at creation); Completed forms are blocked.
        [RequirePermission("Attendance.OTForm.Delete")]
        [HttpPost("{id}/delete")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id, [FromBody] DeleteOtFormDto request)
        {
            await _otFormService.DeleteAsync(id, CurrentUserName, CurrentFullName, request);
            return Success(true, "Đã xoá đơn.");
        }

        // Public endpoints for the email Approve/Reject links, a supplementary channel; the token is the only credential.
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

        // Remove-employee from the email-confirm page; requires the secondary password like Approve/Reject.
        // Does NOT consume the token, since the approver may still need it to Approve/Reject right after.
        [AllowAnonymous]
        [HttpPost("email-confirm/{token}/employees/remove")]
        public async Task<ActionResult<ApiResponse<OtFormDto>>> RemoveEmployeeByEmailToken(string token, [FromBody] RemoveOtFormEmployeeByEmailTokenDto request)
        {
            var result = await _otFormService.RemoveEmployeeByEmailTokenAsync(token, request);
            return Success(result, "Đã loại nhân viên khỏi đơn.");
        }
    }
}
