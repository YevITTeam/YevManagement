using Identity.Application.Dtos.UserDto;
using Identity.Application.Interfaces.Service;
using Identity.Domain.Entities;
using Shared.Application.Services;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Services
{
    public class PermissionService : BaseService<IIdentityUnitOfWork>, IPermissionService
    {
        public PermissionService(IIdentityUnitOfWork identityUnitOfWork) : base(identityUnitOfWork)
        {
        }

        public async Task<List<PermissionDto>> GetAllPermissionsAsync()
        {
            var permissions = await _unitOfWork.Permissions.GetAllAsync();

            return permissions
                .OrderBy(p => p.Module)
                .ThenBy(p => p.Code)
                .Select(p => new PermissionDto
                {
                    Id = p.Id,
                    Code = p.Code,
                    Module = p.Module,
                    Description = p.Description
                }).ToList();
        }

        public async Task<List<PermissionDto>> GetRolePermissionsAsync(int roleId)
        {
            var role = await _unitOfWork.Roles.FirstOrDefaultAsync(r => r.Id == roleId, r => r.Permissions);
            role.OrThrowNotFound("Quyền (Role)", roleId);

            return role.Permissions
                .OrderBy(p => p.Module)
                .ThenBy(p => p.Code)
                .Select(p => new PermissionDto
                {
                    Id = p.Id,
                    Code = p.Code,
                    Module = p.Module,
                    Description = p.Description
                }).ToList();
        }

        public async Task UpdateRolePermissionsAsync(UpdateRolePermissionsDto dto)
        {
            var role = await _unitOfWork.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId, r => r.Permissions);
            role.OrThrowNotFound("Quyền (Role)", dto.RoleId);

            role.Permissions.Clear();

            if (dto.PermissionIds.Any())
            {
                var newPermissions = await _unitOfWork.Permissions.FindAsync(p => dto.PermissionIds.Contains(p.Id));

                foreach (var permission in newPermissions)
                {
                    role.Permissions.Add(permission);
                }
            }

            _unitOfWork.Roles.Update(role);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
