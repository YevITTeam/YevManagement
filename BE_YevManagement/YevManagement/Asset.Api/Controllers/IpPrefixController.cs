using Asset.Application.Dtos.IpPrefixes;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class IpPrefixController : BaseController
    {
        private readonly IIpPrefixService _ipPrefixService;

        public IpPrefixController(IIpPrefixService ipPrefixService)
        {
            _ipPrefixService = ipPrefixService;
        }

        [RequirePermission("Asset.IpPrefix.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<IpPrefixDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _ipPrefixService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.IpPrefix.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<IpPrefixDto>>>> GetAllActive()
        {
            var result = await _ipPrefixService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.IpPrefix.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<IpPrefixDto>>> GetById(int id)
        {
            var result = await _ipPrefixService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.IpPrefix.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateIpPrefixDto request)
        {
            var result = await _ipPrefixService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result,
                $"Thêm prefix thành công, đã sinh {result.AvailableIpCount} địa chỉ IP.");
        }

        // Không còn Update cho IpPrefix (2026-07-11, quyết định người dùng) — IpPrefix chỉ
        // được Create (tự sinh 255 IpAddress con) và Delete (cascade IP con chưa dùng, chặn
        // nếu còn IP con đang gán cho Device).

        [RequirePermission("Asset.IpPrefix.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _ipPrefixService.DeleteAsync(id);
            return Success(true, "Xóa prefix thành công.");
        }
    }
}
