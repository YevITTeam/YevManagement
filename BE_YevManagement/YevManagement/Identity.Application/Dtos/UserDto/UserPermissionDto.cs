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

        // true = được cấp thêm riêng cho user này; false = bị thu hồi riêng khỏi user này
        // (đè lên permission mà Role của user đang cấp).
        public bool IsGranted { get; set; }
    }
}
