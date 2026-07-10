using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    // Body request cho PUT /api/Permission/user/{userId} — UserId lấy từ route,
    // không cần lặp lại trong body (khác UpdateUserPermissionsDto dùng nội bộ Service).
    public class UpdateUserPermissionOverridesDto
    {
        public List<int> GrantPermissionIds { get; set; } = new List<int>();
        public List<int> DenyPermissionIds { get; set; } = new List<int>();
    }
}
