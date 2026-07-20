using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    // Request body for PUT /api/Permission/user/{userId} — UserId comes from the route,
    // so it does not need to be repeated in the body (unlike UpdateUserPermissionsDto used internally by the Service).
    public class UpdateUserPermissionOverridesDto
    {
        public List<int> GrantPermissionIds { get; set; } = new List<int>();
        public List<int> DenyPermissionIds { get; set; } = new List<int>();
    }
}
