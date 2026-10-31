using Asset.Application.Dtos.ServerChecks;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class ServerCheckAssignmentController : BaseController
    {
        private readonly IServerCheckAssignmentService _assignmentService;

        public ServerCheckAssignmentController(IServerCheckAssignmentService assignmentService)
        {
            _assignmentService = assignmentService;
        }

        [RequirePermission("Asset.ServerCheck.Assign")]
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<ServerCheckAssignmentDto>>>> GetAll()
        {
            return Success(await _assignmentService.GetAllAsync());
        }

        // Null when the caller has no assignment.
        [RequirePermission("Asset.ServerCheck.Scan")]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<ServerCheckAssignmentDto?>>> GetMine()
        {
            return Success(await _assignmentService.GetMyAssignmentAsync());
        }

        [RequirePermission("Asset.ServerCheck.Assign")]
        [HttpPut]
        public async Task<ActionResult<ApiResponse<ServerCheckAssignmentDto>>> Save([FromBody] SaveServerCheckAssignmentDto request)
        {
            return Success(await _assignmentService.SaveAsync(request), "Lưu phân công thành công.");
        }

        [RequirePermission("Asset.ServerCheck.Assign")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _assignmentService.DeleteAsync(id);
            return Success(true, "Đã bỏ phân công.");
        }
    }
}
