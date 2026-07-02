using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Yev.DTOs.Request
{
    public class CreateRoleRequest
    {
        [Required]
        [MaxLength(50)]
        public string RoleName { get; set; } 
        public string? Description { get; set; }
    }
}
