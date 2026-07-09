using Asset.Application.Dtos.IpAddresses;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    [AllowAnonymous]
    public class IpAddressController : BaseController
    {
        private readonly IIpAddressService _ipAddressService;

        public IpAddressController(IIpAddressService ipAddressService)
        {
            _ipAddressService = ipAddressService;
        }

        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<IpAddressDto>>>> GetPaged([FromQuery] IpAddressFilterRequest request)
        {
            var result = await _ipAddressService.GetPagedAsync(request);
            return Success(result);
        }

        [HttpGet("available")]
        public async Task<ActionResult<ApiResponse<List<IpAddressDto>>>> GetAvailable([FromQuery] string? keyword)
        {
            var result = await _ipAddressService.GetAvailableAsync(keyword);
            return Success(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<IpAddressDto>>> GetById(int id)
        {
            var result = await _ipAddressService.GetByIdAsync(id);
            return Success(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateIpAddressDto request)
        {
            var result = await _ipAddressService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm địa chỉ IP thành công.");
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateIpAddressDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _ipAddressService.UpdateAsync(request);
            return Success(true, "Cập nhật địa chỉ IP thành công.");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _ipAddressService.DeleteAsync(id);
            return Success(true, "Xóa địa chỉ IP thành công.");
        }

        [HttpPut("{id}/assign")]
        public async Task<ActionResult<ApiResponse<bool>>> Assign(int id, [FromBody] AssignIpAddressDto request)
        {
            await _ipAddressService.AssignToDeviceAsync(id, request);
            return Success(true, "Gán địa chỉ IP cho thiết bị thành công.");
        }

        [HttpPut("{id}/unassign")]
        public async Task<ActionResult<ApiResponse<bool>>> Unassign(int id)
        {
            await _ipAddressService.UnassignAsync(id);
            return Success(true, "Gỡ gán địa chỉ IP thành công.");
        }
    }
}
