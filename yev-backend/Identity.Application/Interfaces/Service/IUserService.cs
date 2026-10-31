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

        // TEST accounts only (no AD); used solely in Development.
        Task<bool> ValidateTestLoginAsync(string userName, string password);
    }
}
