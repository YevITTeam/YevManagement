using Attendance.Application.Dtos.OtForms;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class OtFormController : BaseController
    {
        private const string GeneralDirectorRole = "Tổng Giám Đốc";

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

        // Trưởng Group tạo đơn — ký "Người đề nghị" ngay trong request này (SubmitterSignatureImage).
        [RequirePermission("Attendance.OTForm.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOtFormDto request)
        {
            var result = await _otFormService.CreateAsync(CurrentUserName, request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Tạo đơn tăng ca thành công.");
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<ApiResponse<bool>>> Approve(int id, [FromBody] ApproveOtFormDto request)
        {
            var isGeneralDirector = User.IsInRole(GeneralDirectorRole);
            await _otFormService.ApproveAsync(id, CurrentUserName, isGeneralDirector, request);
            return Success(true, "Duyệt đơn thành công.");
        }

        [RequirePermission("Attendance.OTForm.Approve")]
        [HttpPost("{id}/reject")]
        public async Task<ActionResult<ApiResponse<bool>>> Reject(int id, [FromBody] RejectOtFormDto request)
        {
            var isGeneralDirector = User.IsInRole(GeneralDirectorRole);
            await _otFormService.RejectAsync(id, CurrentUserName, isGeneralDirector, request);
            return Success(true, "Từ chối đơn thành công.");
        }
    }
}
