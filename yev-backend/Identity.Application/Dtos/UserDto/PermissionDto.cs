using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class PermissionDto
    {
        public int Id { get; set; }
        public string Code { get; set; }
        public string Module { get; set; }
        public string? Description { get; set; }
    }
}
