using System;
using System.Collections.Generic;
using System.Text;
using Yev.DTOs.Auth;
using Yev.DTOs.Request;
using Yev.Repositories.Interfaces;
using Yev.Services.Interfaces;

namespace Yev.Services.Implementations
{
    public class AuthService : IAuthService
    {
        private readonly IAuthRepository _repo;

        public AuthService(IAuthRepository repo)
        {
            _repo = repo;
        }

        // Logic tự động cấp quyền (JIT Provisioning) thao tác 100% bằng DTO
        public async Task<UserDto> SyncWindowsUserAsync(string username, string fullName)
        {
            var existingUser = await _repo.GetUserWithRolesAsync(username);
            if (existingUser != null)
            {
                return existingUser; // Nếu có rồi thì trả về luôn DTO
            }

            // Nếu user mới tinh, lấy Id của role Basic
            int basicRoleId = await _repo.GetRoleIdByNameAsync("Basic");

            // Yêu cầu Repo tạo mới và trả về DTO
            return await _repo.CreateUserAsync(username, fullName, basicRoleId);
        }

        public async Task<List<RoleDto>> GetAllRolesAsync()
        {
            return await _repo.GetAllRolesAsync();
        }

        public async Task<List<UserDto>> GetAllUsersAsync()
        {
            return await _repo.GetAllUsersAsync();
        }

        public async Task UpdateUserRolesAsync(UpdateUserRolesDto request)
        {
            // Kiểm tra an toàn dữ liệu cơ bản ở tầng Service
            if (request == null || request.RoleIds == null)
            {
                throw new ArgumentException("Dữ liệu cấp quyền không hợp lệ.");
            }

            // Đẩy xuống tầng Repository để thực thi các câu lệnh Entity Framework
            await _repo.UpdateUserRolesAsync(request.UserId, request.RoleIds);
        }
    }
}
