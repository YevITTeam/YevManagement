using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UpdateUserPermissionsDto
    {
        public int UserId { get; set; }

        // Permission cấp thêm riêng cho user này (dù Role không có).
        public List<int> GrantPermissionIds { get; set; } = new List<int>();

        // Permission thu hồi riêng khỏi user này (dù Role có cấp).
        public List<int> DenyPermissionIds { get; set; } = new List<int>();
    }
}
