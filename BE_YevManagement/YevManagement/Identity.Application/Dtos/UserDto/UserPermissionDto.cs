using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UserPermissionDto
    {
        public int PermissionId { get; set; }
        public string Code { get; set; }
        public string Module { get; set; }
        public string? Description { get; set; }

        // true = specifically granted to this user; false = specifically revoked from this user
        // (overrides the permission granted by the user's Role).
        public bool IsGranted { get; set; }
    }
}
