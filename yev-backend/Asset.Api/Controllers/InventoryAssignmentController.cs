using Asset.Application.Dtos.Inventory;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    // Phân công user ↔ xưởng cho kiểm kê thiết bị (asset-module.md §1.22).
    public class InventoryAssignmentController : BaseController
    {
        private readonly IInventoryAssignmentService _assignmentService;

        public InventoryAssignmentController(IInventoryAssignmentService assignmentService)
        {
            _assignmentService = assignmentService;
        }

        [RequirePermission("Asset.Inventory.Assign")]
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<InventoryAssignmentDto>>>> GetAll()
        {
            return Success(await _assignmentService.GetAllAsync());
        }

        [RequirePermission("Asset.Inventory.Scan")]
        [HttpGet("me")]
        public async Task<ActionResult<ApiResponse<InventoryAssignmentDto?>>> GetMine()
        {
            return Success(await _assignmentService.GetMyAssignmentAsync());
        }

        [RequirePermission("Asset.Inventory.Assign")]
        [HttpPut]
        public async Task<ActionResult<ApiResponse<InventoryAssignmentDto>>> Save([FromBody] SaveInventoryAssignmentDto request)
        {
            return Success(await _assignmentService.SaveAsync(request), "Lưu phân công thành công.");
        }

        [RequirePermission("Asset.Inventory.Assign")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _assignmentService.DeleteAsync(id);
            return Success(true, "Đã bỏ phân công.");
        }
    }
}
