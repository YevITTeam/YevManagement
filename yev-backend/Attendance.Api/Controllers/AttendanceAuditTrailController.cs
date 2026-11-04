using Attendance.Application.Dtos.AuditTrails;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class AttendanceAuditTrailController : BaseController
    {
        private readonly IAttendanceAuditTrailService _auditTrailService;
        private readonly IAttendanceMailLogService _mailLogService;

        public AttendanceAuditTrailController(IAttendanceAuditTrailService auditTrailService, IAttendanceMailLogService mailLogService)
        {
            _auditTrailService = auditTrailService;
            _mailLogService = mailLogService;
        }

        [RequirePermission("Attendance.AuditTrail.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<AttendanceAuditTrailDto>>>> GetPaged([FromQuery] AttendanceAuditTrailFilterRequest request)
            => Success(await _auditTrailService.GetPagedAsync(request));

        [RequirePermission("Attendance.AuditTrail.View")]
        [HttpGet("mail-logs")]
        public async Task<ActionResult<ApiResponse<PagedResponse<AttendanceMailLogDto>>>> GetMailLogs([FromQuery] AttendanceMailLogFilterRequest request)
            => Success(await _mailLogService.GetPagedAsync(request));
    }
}
