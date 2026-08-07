using Attendance.Application.Dtos.JobTitles;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class JobTitleController : BaseController
    {
        private readonly IJobTitleService _jobTitleService;
        private readonly IJobTitleApprovalChainService _jobTitleApprovalChainService;

        public JobTitleController(IJobTitleService jobTitleService, IJobTitleApprovalChainService jobTitleApprovalChainService)
        {
            _jobTitleService = jobTitleService;
            _jobTitleApprovalChainService = jobTitleApprovalChainService;
        }

        [RequirePermission("Attendance.JobTitle.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<JobTitleDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _jobTitleService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.JobTitle.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<JobTitleDto>>>> GetAllActive()
        {
            var result = await _jobTitleService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.JobTitle.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<JobTitleDto>>> GetById(int id)
        {
            var result = await _jobTitleService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Attendance.JobTitle.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateJobTitleDto request)
        {
            var result = await _jobTitleService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm chức vụ thành công.");
        }

        [RequirePermission("Attendance.JobTitle.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateJobTitleDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _jobTitleService.UpdateAsync(request);
            return Success(true, "Cập nhật chức vụ thành công.");
        }

        [RequirePermission("Attendance.JobTitle.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _jobTitleService.DeleteAsync(id);
            return Success(true, "Xóa chức vụ thành công.");
        }

        // Xem trước chuỗi duyệt tự động (Giai đoạn 2 "Cây chức vụ", xây song song — KHÔNG đụng tới
        // OtForm/cơ chế duyệt hiện tại). Dùng để test thuật toán trên dữ liệu thật trước khi wiring.
        [RequirePermission("Attendance.JobTitle.View")]
        [HttpGet("resolve-chain")]
        public async Task<ActionResult<ApiResponse<ResolveApprovalChainResultDto>>> ResolveChain(
            [FromQuery] int employeeId, [FromQuery] int otCaseId)
        {
            var result = await _jobTitleApprovalChainService.ResolveChainAsync(employeeId, otCaseId);
            return Success(result);
        }
    }
}
