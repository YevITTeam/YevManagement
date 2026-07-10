using Identity.Application.Dtos.UserDto;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Interfaces.Service
{
    public interface IUserService
    {
        Task<UserDto> SyncWindowsUserAsync(string username, string fullName);
        Task<List<UserDto>> GetAllUsersAsync();
        Task UpdateUserRolesAsync(UpdateUserRolesDto request);
        Task<UserDto> CreateUserAsync(CreateUserDto request);
    }
}
