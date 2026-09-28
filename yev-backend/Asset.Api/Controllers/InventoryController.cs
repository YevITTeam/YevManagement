using Asset.Application.Dtos.Inventory;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    // Kiểm kê thiết bị bằng quét mã theo xưởng (asset-module.md §1.22).
    public class InventoryController : BaseController
    {
        private readonly IInventoryService _inventoryService;

        public InventoryController(IInventoryService inventoryService)
        {
            _inventoryService = inventoryService;
        }

        // Chỉ dùng cho màn quét kiosk (xưởng của chính người gọi) — khác GetById/grid-list vốn cần View.
        [RequirePermission("Asset.Inventory.Scan")]
        [HttpGet("current")]
        public async Task<ActionResult<ApiResponse<InventorySessionDto?>>> GetCurrent()
        {
            var result = await _inventoryService.GetCurrentSessionAsync();
            return Success(result);
        }

        [RequirePermission("Asset.Inventory.Scan")]
        [HttpPost("start")]
        public async Task<ActionResult<ApiResponse<InventorySessionDto>>> Start()
        {
            var result = await _inventoryService.StartSessionAsync();
            return Success(result, "Bắt đầu phiên kiểm kê thành công.");
        }

        [RequirePermission("Asset.Inventory.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<InventorySessionDto>>> GetById(int id)
        {
            var result = await _inventoryService.GetSessionByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.Inventory.Scan")]
        [HttpPost("{id}/scan")]
        public async Task<ActionResult<ApiResponse<InventorySessionItemDto>>> Scan(int id, [FromBody] ScanInventoryItemDto request)
        {
            var result = await _inventoryService.ScanAsync(id, request);
            return Success(result, $"Đã ghi nhận {result.DeviceCode} - {result.DeviceName}.");
        }

        [RequirePermission("Asset.Inventory.Scan")]
        [HttpPost("{id}/end")]
        public async Task<ActionResult<ApiResponse<InventorySessionDto>>> End(int id, [FromBody] EndInventorySessionDto request)
        {
            var result = await _inventoryService.EndSessionAsync(id, request);
            return Success(result, "Kết thúc phiên kiểm kê thành công.");
        }

        [RequirePermission("Asset.Inventory.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<InventorySessionDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 30,
            [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, [FromQuery] int? branchId = null)
        {
            var result = await _inventoryService.GetSessionsPagedAsync(pageIndex, pageSize, fromDate, toDate, branchId);
            return Success(result);
        }

        // Trả file .xlsx — KHÔNG phải ApiResponse<T> (cùng lý do ServerCheckController.ExportReport).
        [RequirePermission("Asset.Inventory.View")]
        [HttpGet("{id}/export")]
        public async Task<IActionResult> ExportSession(int id)
        {
            var (content, fileName) = await _inventoryService.ExportSessionAsync(id);
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
