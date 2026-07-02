using System;
using System.Collections.Generic;
using System.Text;
using Yev.DTOs.Auth;
using Yev.DTOs.Request;

namespace Yev.Repositories.Interfaces
{
    public interface IRoleRepository
    {
        Task<RoleDto> CreateRoleAsync(CreateRoleRequest role);

        Task<RoleDto> UpdateRoleAsync(int roleId, CreateRoleRequest role);

        Task<bool> DeleteRoleAsync(int RoleId);
    }
}
