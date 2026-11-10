using Identity.Application.Dtos.LocalAccountDto;
using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Identity.Api.Controllers
{
    [RequirePermission("Identity.LocalAccount.Manage")]
    public class LocalAccountController : BaseController
    {
        private readonly ILocalAccountService _service;

        public LocalAccountController(ILocalAccountService service)
        {
            _service = service;
        }

        [HttpGet("prefixes")]
        public async Task<ActionResult<ApiResponse<List<LocalAccountPrefixDto>>>> GetPrefixes()
        {
            return Success(await _service.GetPrefixesAsync(), "Lấy danh sách tiền tố thành công!");
        }

        [HttpPost("prefixes")]
        public async Task<ActionResult<ApiResponse<LocalAccountPrefixDto>>> CreatePrefix([FromBody] CreateLocalAccountPrefixDto request)
        {
            return Success(await _service.CreatePrefixAsync(request, User.Identity?.Name), "Đã thêm tiền tố!");
        }

        [HttpDelete("prefixes/{id:int}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeletePrefix(int id)
        {
            await _service.DeletePrefixAsync(id);
            return Success(true, "Đã xoá tiền tố!");
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<UserDto>>> Create([FromBody] CreateLocalAccountDto request)
        {
            return Success(await _service.CreateAccountAsync(request, User.Identity?.Name), "Đã tạo tài khoản nội bộ!");
        }

        [HttpPut("{userId:int}/password")]
        public async Task<ActionResult<ApiResponse<bool>>> ResetPassword(int userId, [FromBody] ResetLocalPasswordDto request)
        {
            await _service.ResetPasswordAsync(userId, request.NewPassword);
            return Success(true, "Đã đặt lại mật khẩu!");
        }
    }
}
