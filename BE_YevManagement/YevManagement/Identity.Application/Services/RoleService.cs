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
    public class RoleService : BaseService<IIdentityUnitOfWork>, IRoleService
    {
        public RoleService(IIdentityUnitOfWork identityUnitOfWork) : base(identityUnitOfWork)
        {
            
        }

        public async Task<RoleDto> CreateRoleAsync(RoleDto roleDto)
        {
            var roles = await _unitOfWork.Roles.FindAsync(x => x.RoleName == roleDto.RoleName && x.IsDeleted == false);

            if(roles != null && roles.Count > 0)
            {
                throw new DomainException("Quyền đã tồn tại trong hệ thống");
            }

            var newRole = new Role
            {
                RoleName = roleDto.RoleName,
                Description = roleDto.Description,
                IsDeleted = false
            };

            await _unitOfWork.Roles.AddAsync(newRole);
            await _unitOfWork.SaveChangesAsync();
            return new RoleDto
            {
                Id = newRole.Id,
                RoleName = newRole.RoleName,
                Description = newRole.Description
            };


        }

        public async Task<bool> DeleteRoleByIdAsync(int roleId)
        {
            var role = await _unitOfWork.Roles.GetByIdAsync(roleId);
            if (role == null)
            {
                return false;
            }

            role.IsDeleted = true;
            _unitOfWork.Roles.Update(role);
            await _unitOfWork.SaveChangesAsync();
            return true;
        }

        public async Task<List<RoleDto>> GetAllRolesAsync()
        {
            var roles = await _unitOfWork.Roles.FindAsync(x => x.IsDeleted == false);

            return roles.Select(role => new RoleDto
            {
                Id = role.Id,
                RoleName = role.RoleName,
                Description = role.Description
            }).ToList();
        }

        public async Task<RoleDto> GetRoleByIdAsync(int roleId)
        {
            var role = await _unitOfWork.Roles.GetByIdAsync(roleId);
            return new RoleDto
            {
                Id = role.Id,
                RoleName = role.RoleName,
                Description = role.Description
            };
        }

        public async Task<bool> UpdateRoleByIdAsync(int roleId, UpdateRoleDto roleDto)
        {
            var role = await _unitOfWork.Roles.GetByIdAsync(roleId);
            if(role == null) 
            { 
                return false; 
            }
            role.RoleName = roleDto.RoleName;
            role.Description = roleDto.Description;

            await _unitOfWork.SaveChangesAsync();
            return true;

        }
    }
}
