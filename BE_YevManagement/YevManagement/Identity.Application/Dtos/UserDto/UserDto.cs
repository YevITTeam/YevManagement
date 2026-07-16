using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UserDto
    {
        public int Id { get; set; }
        public string UserName { get; set; }
        public string FullName { get; set; }
        public string? DeviceName { get; set; }

        // Tự resolve từ AD lúc đăng nhập (MyClaimsTransformation.GetActualEmail) — dùng để gửi email
        // xác nhận cập nhật chữ ký/duyệt đơn (Attendance module). Nullable vì không phải AD account
        // nào cũng có sẵn mail.
        public string? Email { get; set; }

        public List<string> Roles { get; set; } = new List<string>();
        public List<string> Permissions { get; set; } = new List<string>();
    }
}
