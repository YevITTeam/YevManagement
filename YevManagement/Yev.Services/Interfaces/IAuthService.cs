using System;
using System.Collections.Generic;
using System.Text;
using Yev.DTOs.Auth;
using Yev.DTOs.Request;

namespace Yev.Services.Interfaces
{
    public interface IAuthService
    {
        Task<UserDto> SyncWindowsUserAsync(string username, string fullName);
        Task<List<RoleDto>> GetAllRolesAsync();
        Task<List<UserDto>> GetAllUsersAsync();
        Task UpdateUserRolesAsync(UpdateUserRolesDto request);
    }
}
