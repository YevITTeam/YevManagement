using Identity.Application.Dtos.UserDto;
using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Interfaces.Service
{
    public interface IPermissionService
    {
        Task<List<PermissionDto>> GetAllPermissionsAsync();
        Task<List<PermissionDto>> GetRolePermissionsAsync(int roleId);
        Task UpdateRolePermissionsAsync(UpdateRolePermissionsDto dto);
    }
}
