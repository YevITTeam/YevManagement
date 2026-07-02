using System;
using System.Collections.Generic;
using System.Text;
using Yev.Entities.Users;
using Yev.DTOs.Auth;

namespace Yev.Repositories.Interfaces
{
    public interface IAuthRepository
    {
        Task<UserDto> GetUserWithRolesAsync(string username);
        Task<UserDto> CreateUserAsync(string username, string fullName, int basicRoleId);
        Task<int> GetRoleIdByNameAsync(string roleName);
        Task<List<RoleDto>> GetAllRolesAsync();
        Task<List<UserDto>> GetAllUsersAsync();

        Task UpdateUserRolesAsync(int userId, List<int> roleIds);
    }
}
