using Identity.Application.Dtos.UserEmailDto;
using Identity.Application.Interfaces.Service;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Identity.Api.Controllers
{
    // Admin management of a user's email addresses and which address each module sends to.
    [RequirePermission("Identity.UserEmail.Manage")]
    public class UserEmailController : BaseController
    {
        private readonly IUserEmailService _service;

        public UserEmailController(IUserEmailService service)
        {
            _service = service;
        }

        [HttpGet("user/{userId:int}")]
        public async Task<ActionResult<ApiResponse<UserEmailOverviewDto>>> GetOverview(int userId)
        {
            var data = await _service.GetOverviewAsync(userId);
            return Success(data, "Lấy danh sách email thành công!");
        }

        [HttpGet("user/{userId:int}/suggestions")]
        public async Task<ActionResult<ApiResponse<List<UserEmailSuggestionDto>>>> GetSuggestions(int userId)
        {
            var data = await _service.GetSuggestionsAsync(userId);
            return Success(data, "Lấy đề xuất email thành công!");
        }

        [HttpPost("user/{userId:int}")]
        public async Task<ActionResult<ApiResponse<UserEmailOverviewDto>>> Add(int userId, [FromBody] CreateUserEmailDto request)
        {
            var data = await _service.AddAsync(userId, request);
            return Success(data, "Đã thêm email!");
        }

        [HttpDelete("user/{userId:int}/{userEmailId:int}")]
        public async Task<ActionResult<ApiResponse<UserEmailOverviewDto>>> Delete(int userId, int userEmailId)
        {
            var data = await _service.DeleteAsync(userId, userEmailId);
            return Success(data, "Đã xoá email!");
        }

        [HttpPut("user/{userId:int}/{userEmailId:int}/primary")]
        public async Task<ActionResult<ApiResponse<UserEmailOverviewDto>>> SetPrimary(int userId, int userEmailId)
        {
            var data = await _service.SetPrimaryAsync(userId, userEmailId);
            return Success(data, "Đã đặt email chính!");
        }

        [HttpPut("user/{userId:int}/modules")]
        public async Task<ActionResult<ApiResponse<UserEmailOverviewDto>>> UpdateModules(int userId, [FromBody] UpdateUserEmailModulesDto request)
        {
            var data = await _service.UpdateModulesAsync(userId, request);
            return Success(data, "Đã lưu cấu hình email theo module!");
        }
    }
}
