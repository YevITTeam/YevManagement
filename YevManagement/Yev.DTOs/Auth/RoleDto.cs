using System;
using System.Collections.Generic;
using System.Text;

namespace Yev.DTOs.Auth
{
    public class RoleDto
    {
        public int Id { get; set; }
        public string RoleName { get; set; }
        public string? Description { get; set; }
    }
}
