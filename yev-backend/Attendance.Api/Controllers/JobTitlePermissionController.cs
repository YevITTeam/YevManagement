using Attendance.Application.Dtos.JobTitlePermissions;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class JobTitlePermissionController : BaseController
    {
        private readonly IJobTitlePermissionService _jobTitlePermissionService;

        public JobTitlePermissionController(IJobTitlePermissionService jobTitlePermissionService)
        {
            _jobTitlePermissionService = jobTitlePermissionService;
        }

        [RequirePermission("Attendance.JobTitlePermission.View")]
        [HttpGet("by-job-title/{jobTitleId}")]
        public async Task<ActionResult<ApiResponse<List<JobTitlePermissionDto>>>> GetByJobTitle(int jobTitleId)
        {
            var result = await _jobTitlePermissionService.GetByJobTitleAsync(jobTitleId);
            return Success(result);
        }

        // Danh sách permission code được phép chọn (nhóm "tham gia quy trình") — FE dùng để lọc UI,
        // không hardcode song song ở cả 2 phía.
        [RequirePermission("Attendance.JobTitlePermission.View")]
        [HttpGet("allowed-codes")]
        public ActionResult<ApiResponse<List<string>>> GetAllowedCodes()
        {
            return Success(_jobTitlePermissionService.GetAllowedPermissionCodes());
        }

        [RequirePermission("Attendance.JobTitlePermission.Update")]
        [HttpPut("by-job-title/{jobTitleId}")]
        public async Task<ActionResult<ApiResponse<List<JobTitlePermissionDto>>>> Replace(
            int jobTitleId, [FromBody] ReplaceJobTitlePermissionsDto request)
        {
            var result = await _jobTitlePermissionService.ReplaceAsync(jobTitleId, request);
            return Success(result, "Cập nhật quyền theo Chức vụ thành công.");
        }
    }
}
