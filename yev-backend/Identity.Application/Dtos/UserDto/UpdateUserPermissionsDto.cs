using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UpdateUserPermissionsDto
    {
        public int UserId { get; set; }

        // Permissions granted specifically to this user (even if the Role doesn't have them).
        public List<int> GrantPermissionIds { get; set; } = new List<int>();

        // Permissions revoked specifically from this user (even if the Role grants them).
        public List<int> DenyPermissionIds { get; set; } = new List<int>();
    }
}
