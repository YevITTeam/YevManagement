using Asset.Application.Dtos.Branches;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    public class BranchController : BaseController
    {
        private readonly IBranchService _branchService;

        public BranchController(IBranchService branchService)
        {
            _branchService = branchService;
        }

        [RequirePermission("Asset.Branch.View")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<BranchDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 50, [FromQuery] string? keyword = null)
        {
            var result = await _branchService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.Branch.View")]
        [HttpGet("all")]
        public async Task<ActionResult<ApiResponse<List<BranchDto>>>> GetAllActive()
        {
            var result = await _branchService.GetAllActiveAsync();
            return Success(result);
        }

        [RequirePermission("Asset.Branch.View")]
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<BranchDto>>> GetById(int id)
        {
            var result = await _branchService.GetByIdAsync(id);
            return Success(result);
        }

        [RequirePermission("Asset.Branch.Create")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBranchDto request)
        {
            var result = await _branchService.CreateAsync(request);
            return CreatedSuccess(nameof(GetById), new { id = result.Id }, result, "Thêm chi nhánh thành công.");
        }

        [RequirePermission("Asset.Branch.Update")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateBranchDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _branchService.UpdateAsync(request);
            return Success(true, "Cập nhật chi nhánh thành công.");
        }

        [RequirePermission("Asset.Branch.Delete")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _branchService.DeleteAsync(id);
            return Success(true, "Xóa chi nhánh thành công.");
        }
    }
}