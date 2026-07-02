using System;
using System.Collections.Generic;
using System.Text;

namespace Yev.DTOs.Auth
{
    public class UserDto
    {
        public int Id { get; set; }
        public string UserName { get; set; }
        public string FullName { get; set; }
        public string? IpAddress { get; set; }
        public string? DeviceName { get; set; }
        public List<string> Roles { get; set; } = new List<string>();
    }

}
