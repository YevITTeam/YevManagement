using Attendance.Application.Dtos.Workshops;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class WorkshopController : BaseController
    {
        private readonly IWorkshopService _workshopService;

        public WorkshopController(IWorkshopService workshopService)
        {
            _workshopService = workshopService;
        }

        [RequirePermission("Attendance.Workshop.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<WorkshopDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _workshopService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.Workshop.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<WorkshopDto>>>> GetAllActive()
        {
            var result = await _workshopService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Attendance.Workshop.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<WorkshopDto>>> GetById(int id)
        {
            var result = await _workshopService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Attendance.Workshop.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateWorkshopDto request)
        {
            var result = await _workshopService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm xưởng thành công.");
        }

        [RequirePermission("Attendance.Workshop.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateWorkshopDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _workshopService.UpdateAsync(request);
            return Success(true, "Cập nhật xưởng thành công.");
        }

        [RequirePermission("Attendance.Workshop.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _workshopService.DeleteAsync(id);
            return Success(true, "Xóa xưởng thành công.");
        }
    }
}
