using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using Yev.DTOs.Auth;
using Yev.DTOs.Request;
using Yev.Entities.Users;
using Yev.Repositories.Interfaces;

namespace Yev.Repositories.Implementations
{
    public class RoleRepository : IRoleRepository
    {
        private readonly AppDbContext _context;

        public RoleRepository(AppDbContext context)
        {
            _context = context;
        }
        public async Task<RoleDto> CreateRoleAsync(CreateRoleRequest role)
        {
            var exsit = await _context.Roles.FirstOrDefaultAsync(x => x.RoleName == role.RoleName && x.IsDeleted == false);
            if (exsit != null)
            {
                throw new InvalidOperationException();
            }

            var newRole = new Role
            {
                RoleName = role.RoleName,
                IsDeleted = false,
                Description = role.Description,
            };

            _context.Roles.Add(newRole);
            await _context.SaveChangesAsync();
            return new RoleDto
            {
                Id = newRole.Id,
                RoleName = newRole.RoleName,
                Description = newRole.Description
            };
        }

        public async Task<bool> DeleteRoleAsync(int roleId)
        {
            var role = await _context.Roles.FirstOrDefaultAsync(x => x.Id == roleId);
            if (role == null) 
            {
                return false;
            }

            role.IsDeleted = true;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<RoleDto> UpdateRoleAsync(int roleId, CreateRoleRequest role)
        {
            var existRole = await _context.Roles.FirstOrDefaultAsync(x => x.Id == roleId);
            if (existRole == null) 
            {
                throw new InvalidOperationException();
            }

            existRole.RoleName = role.RoleName;
            existRole.Description = role.Description;

            await _context.SaveChangesAsync();
            return new RoleDto
            {
                Id = existRole.Id,
                RoleName = existRole.RoleName,
                Description = existRole.Description
            };
        }
    }
}
