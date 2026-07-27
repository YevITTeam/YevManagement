using Asset.Application.Dtos.IpAddresses;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class IpAddressController : BaseController
    {
        private readonly IIpAddressService _ipAddressService;

        public IpAddressController(IIpAddressService ipAddressService)
        {
            _ipAddressService = ipAddressService;
        }

        [RequirePermission("Asset.IpAddress.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<IpAddressDto>>>> GetPaged([FromQuery] IpAddressFilterRequest request)
        {
            var result = await _ipAddressService.GetPagedAsync(request);
            return Success(result);
        }

        [RequirePermission("Asset.IpAddress.View")]
        [HttpGet("available")]
        public async Task<ActionResult<ApiResponse<List<IpAddressDto>>>> GetAvailable([FromQuery] string? keyword)
        {
            var result = await _ipAddressService.GetAvailableAsync(keyword);
            return Success(result);
        }

        [RequirePermission("Asset.IpAddress.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<IpAddressDto>>> GetById(int id)
        {
            var result = await _ipAddressService.GetByIdAsync(id);
            return Success(result);
        }

        // No more manual Create/Delete for individual IpAddresses (2026-07-11, user decision)
        // — IpAddresses are only bulk-generated (255 addresses/prefix) via IpPrefixController.Create
        // and cleaned up accordingly via IpPrefixController.Delete. Update is kept but ONLY
        // allows changing Status + Note (not IpAddress/DeviceId).

        [RequirePermission("Asset.IpAddress.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateIpAddressDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _ipAddressService.UpdateAsync(request);
            return Success(true, "Cập nhật địa chỉ IP thành công.");
        }

        // Bulk status update for the IPs ticked on the grid. Invalid rows (not found / still assigned
        // to a device) are skipped and reported in the result instead of failing the whole batch.
        [RequirePermission("Asset.IpAddress.Update")]
        [HttpPut("bulk-status")]
        public async Task<ActionResult<ApiResponse<BulkUpdateIpAddressStatusResultDto>>> BulkUpdateStatus([FromBody] BulkUpdateIpAddressStatusRequestDto request)
        {
            var result = await _ipAddressService.BulkUpdateStatusAsync(request);
            return Success(result, result.SkippedIpAddresses.Count == 0
                ? $"Đã cập nhật {result.UpdatedCount} địa chỉ IP sang '{result.StatusText}'."
                : $"Đã cập nhật {result.UpdatedCount} địa chỉ IP sang '{result.StatusText}', bỏ qua {result.SkippedIpAddresses.Count} địa chỉ IP.");
        }

        [RequirePermission("Asset.IpAddress.Assign")]
        [HttpPut("{id}/assign")]
        public async Task<ActionResult<ApiResponse<bool>>> Assign(int id, [FromBody] AssignIpAddressDto request)
        {
            await _ipAddressService.AssignToDeviceAsync(id, request);
            return Success(true, "Gán địa chỉ IP cho thiết bị thành công.");
        }

        [RequirePermission("Asset.IpAddress.Assign")]
        [HttpPut("{id}/unassign")]
        public async Task<ActionResult<ApiResponse<bool>>> Unassign(int id)
        {
            await _ipAddressService.UnassignAsync(id);
            return Success(true, "Gỡ gán địa chỉ IP thành công.");
        }
    }
}
