using Asset.Application.Dtos.IpPrefixes;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    [AllowAnonymous]
    public class IpPrefixController : BaseController
    {
        private readonly IIpPrefixService _ipPrefixService;

        public IpPrefixController(IIpPrefixService ipPrefixService)
        {
            _ipPrefixService = ipPrefixService;
        }

        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<IpPrefixDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _ipPrefixService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<IpPrefixDto>>>> GetAllActive()
        {
            var result = await _ipPrefixService.GetAllActiveAsync();
            return Success(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<IpPrefixDto>>> GetById(int id)
        {
            var result = await _ipPrefixService.GetByIdAsync(id);
            return Success(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateIpPrefixDto request)
        {
            var result = await _ipPrefixService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result,
                $"Thêm prefix thành công, đã sinh {result.IpAddressCount} địa chỉ IP.");
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateIpPrefixDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _ipPrefixService.UpdateAsync(request);
            return Success(true, "Cập nhật prefix thành công.");
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _ipPrefixService.DeleteAsync(id);
            return Success(true, "Xóa prefix thành công.");
        }
    }
}
