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

        // Không còn Create/Delete thủ công cho từng IpAddress (2026-07-11, quyết định người
        // dùng) — IpAddress chỉ được sinh hàng loạt (255 địa chỉ/prefix) qua
        // IpPrefixController.Create và dọn theo qua IpPrefixController.Delete. Update được giữ
        // lại nhưng CHỈ đổi được Status + Note (không đổi IpAddress/DeviceId).

        [RequirePermission("Asset.IpAddress.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateIpAddressDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _ipAddressService.UpdateAsync(request);
            return Success(true, "Cập nhật địa chỉ IP thành công.");
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
