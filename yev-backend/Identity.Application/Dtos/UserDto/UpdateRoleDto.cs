using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UpdateRoleDto
    {
        public string RoleName { get; set; }
        public string? Description { get; set; }
    }
}
