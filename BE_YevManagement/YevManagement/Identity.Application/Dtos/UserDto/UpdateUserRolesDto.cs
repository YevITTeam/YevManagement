using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class UpdateUserRolesDto
    {
        public int UserId { get; set; }

        public List<int> RoleIds { get; set; } = new List<int>();
    }
}
