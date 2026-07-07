using Identity.Application.Dtos.UserDto;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Interfaces.Service
{
    public interface IRoleService
    {
        Task<List<RoleDto>> GetAllRolesAsync();
        Task<RoleDto> GetRoleByIdAsync(int roleId);
        Task<bool> DeleteRoleByIdAsync(int roleId);
        Task<bool> UpdateRoleByIdAsync(int roleId, UpdateRoleDto roleDto);
        Task<RoleDto> CreateRoleAsync(RoleDto roleDto);
    }
}
