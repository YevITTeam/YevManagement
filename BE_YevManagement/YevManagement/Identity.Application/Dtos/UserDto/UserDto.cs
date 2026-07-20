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

        // Automatically resolved from AD at login (MyClaimsTransformation.GetActualEmail) — used to
        // send signature-update confirmation / form-approval emails (Attendance module). Nullable
        // because not every AD account has a mail attribute available.
        public string? Email { get; set; }

        public List<string> Roles { get; set; } = new List<string>();
        public List<string> Permissions { get; set; } = new List<string>();
    }
}
