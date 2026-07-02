using System;
using System.Collections.Generic;
using System.Text;
using Yev.DTOs.Auth;
using Yev.DTOs.Request;
using Yev.Repositories.Interfaces;
using Yev.Services.Interfaces;

namespace Yev.Services.Implementations
{
    public class RoleService : IRoleService
    {
        private readonly IRoleRepository _repo;

        public RoleService(IRoleRepository repo)
        {
            _repo = repo;
        }
        public async Task<RoleDto> CreateRoleAsync(CreateRoleRequest role)
        {   

            return await _repo.CreateRoleAsync(role);
        }

        public async Task<bool> DeleteRoleAsync(int RoleId)
        {
            return await _repo.DeleteRoleAsync(RoleId);
        }

        public async Task<RoleDto> UpdateRoleAsync(int roleId, CreateRoleRequest role)
        {
            return await _repo.UpdateRoleAsync(roleId, role);
        }
    }
}
