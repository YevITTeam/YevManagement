using System;
using System.Collections.Generic;
using System.Text;

namespace Yev.DTOs.Request
{
    public class UpdateUserRolesDto
    {
        // ID của nhân viên đang được cấp quyền
        public int UserId { get; set; }

        // Danh sách các ID của Quyền (Role) mà Admin vừa tick chọn trên giao diện Next.js
        public List<int> RoleIds { get; set; } = new List<int>();
    }
}
