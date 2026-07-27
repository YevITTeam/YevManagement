using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UpdateRolePermissionsDto
    {
        public int RoleId { get; set; }

        public List<int> PermissionIds { get; set; } = new List<int>();
    }
}
