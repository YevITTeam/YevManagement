using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Application.Dtos.UserDto
{
    public class PermissionModuleGroupDto
    {
        public string Module { get; set; }
        public List<PermissionEntityGroupDto> Entities { get; set; } = new List<PermissionEntityGroupDto>();
    }

    public class PermissionEntityGroupDto
    {
        public string Entity { get; set; }
        public List<PermissionDto> Permissions { get; set; } = new List<PermissionDto>();
    }
}
