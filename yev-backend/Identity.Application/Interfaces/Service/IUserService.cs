using Identity.Application.Dtos.UserDto;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Interfaces.Service
{
    public interface IUserService
    {
        Task<UserDto> SyncWindowsUserAsync(string username, string fullName);
        Task<List<UserDto>> GetAllUsersAsync(int? roleId = null);
        Task UpdateUserRolesAsync(UpdateUserRolesDto request);
        Task<UserDto> CreateUserAsync(CreateUserDto request);
        Task<UserDto> UpdateUserFullNameAsync(UpdateUserFullNameDto request);
        Task DeleteUserAsync(int userId);

        // Xác thực UserName/Password của 1 tài khoản đăng nhập TEST (TestLoginAccount) — KHÔNG liên
        // quan tới AD, chỉ dùng cho luồng test nhanh khi ASPNETCORE_ENVIRONMENT=Development. Xem
        // AuthController.Login() và Identity.Domain.Entities.TestLoginAccount.
        Task<bool> ValidateTestLoginAsync(string userName, string password);
    }
}
