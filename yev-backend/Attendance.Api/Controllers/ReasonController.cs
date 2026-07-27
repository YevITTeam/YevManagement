using Attendance.Application.Dtos.Reasons;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class ReasonController : BaseController
    {
        private readonly IReasonService _reasonService;

        public ReasonController(IReasonService reasonService)
        {
            _reasonService = reasonService;
        }

        [RequirePermission("Attendance.Reason.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<ReasonDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _reasonService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.Reason.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<ReasonDto>>>> GetAllActive()
        {
            var result = await _reasonService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.Reason.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<ReasonDto>>> GetById(int id)
        {
            var result = await _reasonService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Attendance.Reason.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateReasonDto request)
        {
            var result = await _reasonService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm lý do thành công.");
        }

        [RequirePermission("Attendance.Reason.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateReasonDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _reasonService.UpdateAsync(request);
            return Success(true, "Cập nhật lý do thành công.");
        }

        [RequirePermission("Attendance.Reason.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _reasonService.DeleteAsync(id);
            return Success(true, "Xóa lý do thành công.");
        }
    }
}
