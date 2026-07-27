using Attendance.Application.Dtos.OtCases;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class OtCaseController : BaseController
    {
        private readonly IOtCaseService _otCaseService;

        public OtCaseController(IOtCaseService otCaseService)
        {
            _otCaseService = otCaseService;
        }

        [RequirePermission("Attendance.OtCase.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<OtCaseDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _otCaseService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.OtCase.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<OtCaseDto>>>> GetAllActive()
        {
            var result = await _otCaseService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.OtCase.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OtCaseDto>>> GetById(int id)
        {
            var result = await _otCaseService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Attendance.OtCase.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOtCaseDto request)
        {
            var result = await _otCaseService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm trường hợp OT thành công.");
        }

        [RequirePermission("Attendance.OtCase.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateOtCaseDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _otCaseService.UpdateAsync(request);
            return Success(true, "Cập nhật trường hợp OT thành công.");
        }

        [RequirePermission("Attendance.OtCase.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _otCaseService.DeleteAsync(id);
            return Success(true, "Xóa trường hợp OT thành công.");
        }
    }
}
