using Attendance.Application.Dtos.Groups;
using Attendance.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Attendance.Api.Controllers
{
    public class GroupController : BaseController
    {
        private readonly IGroupService _groupService;

        public GroupController(IGroupService groupService)
        {
            _groupService = groupService;
        }

        [RequirePermission("Attendance.Group.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<GroupDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _groupService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Attendance.Group.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<GroupDto>>>> GetAllActive()
        {
            var result = await _groupService.GetAllActiveAsync();
            return Success(result);
        }

        // FE dùng cho dropdown "Nhóm" phụ thuộc "Bộ phận" đã chọn.
        [RequirePermission("Attendance.Group.View")]
        [HttpGet("by-department/{departmentId}")]
        public async Task<ActionResult<ApiResponse<List<GroupDto>>>> GetByDepartment(int departmentId)
        {
            var result = await _groupService.GetByDepartmentIdAsync(departmentId);
            return Success(result);
        }

        [RequirePermission("Attendance.Group.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<GroupDto>>> GetById(int id)
        {
            var result = await _groupService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Attendance.Group.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateGroupDto request)
        {
            var result = await _groupService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm nhóm thành công.");
        }

        [RequirePermission("Attendance.Group.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateGroupDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _groupService.UpdateAsync(request);
            return Success(true, "Cập nhật nhóm thành công.");
        }

        [RequirePermission("Attendance.Group.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _groupService.DeleteAsync(id);
            return Success(true, "Xóa nhóm thành công.");
        }
    }
}
